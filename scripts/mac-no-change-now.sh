#!/usr/bin/env bash
# "Still no change" — run on Mac AFTER Base44 PASS + rebuild.
# Tells you exactly what to check on iPhone and what each result means.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

LIVE="https://restorebraine.base44.app"
FAIL=0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  NO CHANGE NOW — device diagnosis (hosted v295)              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Live CDN (what phone should load) ────────────────────────────────────
echo "1) Base44 live CDN (hosted WebView loads this)"
HTML=$(curl -sL --max-time 15 "$LIVE/?t=$(date +%s)" 2>/dev/null || true)
GUARD=$(curl -sL --max-time 12 "$LIVE/hosted-runtime-guard.js" 2>/dev/null || true)
BUNDLE=$(echo "$HTML" | grep -o 'assets/index-[^"]*\.js' | head -1 | sed 's|assets/||')
STRIPE_OK=0
echo "$HTML" | grep -q 'return openInApp(u);}var a=Location' && STRIPE_OK=1
GUARD_OK=0
echo "$GUARD" | grep -q 'rbHostedRuntimeGuard' && GUARD_OK=1

echo "   bundle:  ${BUNDLE:-unknown}"
if [ "$STRIPE_OK" = "1" ]; then echo "   stripe:  OK (return openInApp)"; else echo "   stripe:  BROKEN — republish index.html"; FAIL=1; fi
if [ "$GUARD_OK" = "1" ]; then echo "   guard:   OK"; else echo "   guard:   OLD — republish hosted-runtime-guard.js"; FAIL=1; fi
echo ""
echo "   → Open Safari PRIVATE tab: $LIVE"
echo "   → If Safari also unchanged, problem is NOT Xcode — retest Base44 Publish"
echo "   → If Safari shows fixes but app does not, problem is install/cache (below)"
echo ""

# ── 2. Mac repo shell ─────────────────────────────────────────────────────────
echo "2) Mac native shell"
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
echo "   BUILD_STAMP: $STAMP"
echo "   server.url:  ${URL:-missing}"
if [[ "$URL" != *"restorebraine.base44.app"* ]]; then
  echo "   FAIL: not hosted — run bash scripts/mac-full-shakedown.sh --rebuild"
  FAIL=1
fi
echo ""

# ── 3. App.app on Mac (did Xcode Run after rebuild?) ───────────────────────────
echo "3) Xcode App.app on Mac"
APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' ! -path '*Index.noindex*' 2>/dev/null | head -1)
if [ -z "$APP" ]; then
  echo "   FAIL: No App.app — Xcode Run never completed after last rebuild"
  echo "   DerivedData was WIPED during mac-complete-rebuild — you MUST Run again"
  FAIL=1
else
  APP_STAMP=$(cat "$APP/BUILD_STAMP.txt" 2>/dev/null | tr -d '\n' || echo missing)
  APP_URL=$(grep -o '"url": *"[^"]*"' "$APP/capacitor.config.json" 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
  echo "   App.app BUILD_STAMP: $APP_STAMP"
  echo "   App.app server.url:  $APP_URL"
  if [ "$APP_STAMP" != "$STAMP" ] && [ "$STAMP" != "missing" ]; then
    echo "   WARN: App.app stamp ≠ repo — Run again in Xcode"
    FAIL=1
  fi
fi
echo ""

# ── 4. On-iPhone checklist (manual) ───────────────────────────────────────────
echo "4) ON IPHONE — answer these (cannot auto-detect)"
echo ""
echo "   A) Which app icon did you open?"
echo "      • Xcode Run install (today) = correct"
echo "      • TestFlight / old icon = WRONG — delete all Restorebraine copies"
echo ""
echo "   B) Do you see ANY overlay?"
echo "      • TOP-RIGHT purple: shell https://restorebraine.base44.app  (Swift — good)"
echo "      • BOTTOM-LEFT gray: hosted restorebraine.base44.app + Hard reload (JS guard — good)"
echo "      • 'Edit with Base 44' banner = Safari or web preview, NOT native hosted shell"
echo ""
echo "   C) Account tab → scroll down"
echo "      • 'Runtime diagnostic' block = bundle has Account.jsx publish"
echo "      • origin must say restorebraine.base44.app (not capacitor://localhost)"
echo ""
echo "   D) What specifically is unchanged?"
echo "      • folders not persisting → new folder test + claimOrphanedData in Base44 Functions"
echo "      • Stripe still external → native app only; tap payment in app not Safari"
echo "      • same UI as weeks ago → wrong install or cached WebView"
echo ""

# ── 5. Fix sequence ───────────────────────────────────────────────────────────
echo "5) FIX (in order)"
echo "   1. Delete EVERY Restorebraine from iPhone (including TestFlight)"
echo "   2. open ios/App/App.xcworkspace"
echo "   3. Select iPhone by name → Clean Build Folder → Run (Cmd+R)"
echo "   4. Log MUST show: Restorebraine DEPLOY OK"
echo "   5. bash scripts/verify-xcode-app-bundle.sh"
echo "   6. In app: tap 'Hard reload' on bottom-left overlay if present"
echo "   7. Compare Safari private tab vs native app"
echo ""

if [ "$FAIL" -ne 0 ]; then
  echo "══════════════════════════════════════════════════════════════"
  echo "  Mac/ CDN issues found above — fix before expecting phone change"
  echo "══════════════════════════════════════════════════════════════"
  exit 1
fi

echo "══════════════════════════════════════════════════════════════"
echo "  CDN + repo OK — if phone unchanged: wrong app icon or no Xcode Run"
echo "  Run step 5 above, then report overlays A/B and what feature failed (D)"
echo "══════════════════════════════════════════════════════════════"
exit 0
