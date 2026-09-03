#!/usr/bin/env bash
# Diagnose "no change on iPhone/Android" when Base44 audits pass.
# Run on Mac: bash scripts/mac-diagnose-mobile.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

CANONICAL_BRANCH="cursor/fix-folder-persistence-bacf"
LIVE_URL="https://restorebraine.base44.app"
FAIL=0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — mobile no-change diagnosis                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Git branch ───────────────────────────────────────────────────────────
CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')

echo "1) Mac repo"
echo "   Branch:       $CURRENT"
echo "   BUILD_NUMBER: v${BUILD}"
echo "   DEPLOY_BUILD: v${DEPLOY}"
if [ "$CURRENT" != "$CANONICAL_BRANCH" ]; then
  echo "   ⚠ WRONG BRANCH — folder/stripe fixes are on $CANONICAL_BRANCH"
  echo "     Fix: bash scripts/mac-sync-github.sh"
  FAIL=1
else
  echo "   OK: on canonical branch"
fi
echo ""

# ── 2. Hosted vs bundled ────────────────────────────────────────────────────
URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
STRIPE_NAV=$(grep -c 'stripe\.com' ios/App/App/capacitor.config.json 2>/dev/null || echo 0)
BUNDLED_FLAG=$([ -f ios/App/App/BUNDLED_MODE.txt ] && echo yes || echo no)

echo "2) Native shell mode (what the installed app loads)"
echo "   server.url:        ${URL}"
echo "   BUNDLED_MODE.txt:  ${BUNDLED_FLAG}"
echo "   stripe.com hosts:  ${STRIPE_NAV} (must be 0 for in-app Stripe)"
if [[ "$URL" == *"restorebraine.base44.app"* ]]; then
  echo "   Mode: HOSTED — UI comes from live Base44 (Publish required for UI fixes)"
elif [ "$URL" = "missing" ] || [ -z "$URL" ]; then
  echo "   Mode: BUNDLED — UI from ios/public on device (ignores Base44 Publish)"
  echo "   ⚠ If you expected hosted fixes, you ran mac-build.sh without --hosted"
  FAIL=1
else
  echo "   Mode: unknown url=$URL"
fi
if [ "$STRIPE_NAV" -gt 0 ] 2>/dev/null; then
  echo "   ⚠ stripe.com in allowNavigation — payment opens external browser"
  FAIL=1
fi
echo ""

# ── 3. Live Base44 (what hosted apps actually run) ──────────────────────────
echo "3) Live Base44 (hosted WebView loads this)"
LIVE_HTML=$(curl -sL --max-time 12 "$LIVE_URL/" 2>/dev/null || true)
LIVE_DEPLOY=$(echo "$LIVE_HTML" | grep -oE 'content="v[0-9]+"' | head -1 | tr -d '"' || echo unknown)
LIVE_ENTRY=$(echo "$LIVE_HTML" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/.*index-/index-/;s/"//' || echo unknown)
LIVE_BUNDLE=$(curl -sL --max-time 20 "${LIVE_URL}/assets/${LIVE_ENTRY}" 2>/dev/null || true)

echo "   Deploy meta:  ${LIVE_DEPLOY}"
echo "   Bundle:       ${LIVE_ENTRY}"
if [ "$LIVE_DEPLOY" = "v${DEPLOY}" ] 2>/dev/null; then
  echo "   OK: live deploy matches git"
else
  echo "   ⚠ live deploy ${LIVE_DEPLOY} ≠ git v${DEPLOY}"
  FAIL=1
fi
if echo "$LIVE_ENTRY" | grep -q 'mlcqt5ef'; then
  echo "   ⚠ STALE BUNDLE (partial Publish) — run base44-publish-wizard.sh"
  FAIL=1
elif [ "$LIVE_ENTRY" != "unknown" ]; then
  echo "   OK: bundle hash is not known stale file"
fi

MARKERS=""
echo "$LIVE_BUNDLE" | grep -q 'claimOrphanedData' && MARKERS="${MARKERS} claimOrphanedData"
echo "$LIVE_BUNDLE" | grep -q 'data-rb-payment-modal' && MARKERS="${MARKERS} payment-modal"
echo "$LIVE_BUNDLE" | grep -q 'openInWebView' && MARKERS="${MARKERS} stripe-inapp"
if [ -n "$MARKERS" ]; then
  echo "   Bundle markers:${MARKERS}"
else
  echo "   ⚠ bundle missing folder/payment markers — Base44 Publish incomplete"
  FAIL=1
fi
echo ""

# ── 4. Safari vs native split ───────────────────────────────────────────────
echo "4) Safari vs native app (most common hosted trap)"
echo "   On iPhone Safari (private tab): open ${LIVE_URL}"
echo "   Sign in → test folders / payment there first."
echo ""
echo "   If Safari shows fixes but native app does NOT:"
echo "     → WKWebView cache OR old TestFlight binary OR bundled shell"
echo "     → Fix: delete app → run mac-build.sh --hosted --no-git"
echo "            → Xcode Clean → Run (must show Restorebraine DEPLOY OK)"
echo ""
echo "   BUILD_STAMP triggers WebView cache wipe only when the stamp changes."
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
echo "   Repo BUILD_STAMP: ${STAMP}"
echo "   After Base44 Publish alone, stamp may be unchanged → cached old JS on device."
echo ""

# ── 5. Xcode / device install ───────────────────────────────────────────────
echo "5) Xcode device install"
XCODE_TEAMS=$(bash scripts/mac-list-xcode-account-teams.sh --ids-only 2>/dev/null || true)
if [ -n "$XCODE_TEAMS" ]; then
  echo "   Apple ID in Xcode: yes"
else
  echo "   ⚠ Apple ID in Xcode: NO — Run to iPhone never installs new builds"
  FAIL=1
fi

APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' ! -path '*Index.noindex*' 2>/dev/null | head -1)
if [ -n "$APP" ] && [ -f "$APP/capacitor.config.json" ]; then
  APP_URL=$(grep -o '"url": *"[^"]*"' "$APP/capacitor.config.json" 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
  APP_STAMP=$(tr -d '\n' < "$APP/BUILD_STAMP.txt" 2>/dev/null || echo missing)
  echo "   Latest App.app server.url: ${APP_URL}"
  echo "   Latest App.app BUILD_STAMP: ${APP_STAMP}"
  if [[ "$APP_URL" != *"restorebraine.base44.app"* ]] && [[ "$URL" == *"restorebraine.base44.app"* ]]; then
    echo "   ⚠ Xcode built app is BUNDLED but repo is HOSTED — re-run mac-build.sh --hosted"
    FAIL=1
  fi
else
  echo "   No device App.app found — Xcode Run to iPhone may never have succeeded"
  FAIL=1
fi
echo ""

# ── 6. Past fixes that no longer apply ──────────────────────────────────────
echo "6) Past 'revert build' advice — do NOT use for v295 hosted"
echo "   ✗ START-FRESH.md / mac-recover-v4.sh → old branch + bundled (wrong)"
echo "   ✗ mac-apple-login-bundled.sh → bundled mode (ignores Base44)"
echo "   ✗ mac-build.sh without --hosted → capacitor://localhost stale UI"
echo "   ✓ Use: bash scripts/mac-sync-github.sh"
echo "          bash scripts/mac-build.sh --hosted --no-git"
echo "          Base44 Publish (if live bundle stale)"
echo ""

# ── 7. Folder persistence caveats ───────────────────────────────────────────
echo "7) Folder persistence (even when bundle is correct)"
echo "   • Folders created BEFORE v294 without created_by cannot return after reinstall"
echo "   • claimOrphanedData only stamps records with empty created_by on server"
echo "   • Test: create NEW folder → sign out → delete app → reinstall → sign in"
echo ""

echo "══════════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "Git + live Base44 look correct."
  echo "If native app still unchanged: WKWebView cache or wrong install path."
  echo "Run: bash scripts/mac-build.sh --hosted --no-git → Xcode Clean → Run"
else
  echo "Issues found above — fix branch/mode/Base44 before expecting mobile change."
fi
echo "Full audit: node scripts/audit-base44-bundle.mjs"
echo "══════════════════════════════════════════════════════════════"

exit "$FAIL"
