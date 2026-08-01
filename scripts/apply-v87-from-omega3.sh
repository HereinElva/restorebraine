#!/usr/bin/env bash
# apply-v87-from-omega3.sh — Omega 3 gallery + v87 corrections
#
# Default: BUNDLED (Mac terminal controls UI — worked for Step 1 landing)
# Hosted: npm run apply:v87-from-omega3 -- --hosted
#
# IMPORTANT: audit:v87-improvements is READ-ONLY — it never changes phone or mode.
# Regression in commit 14cfaef was flipping default to BUNDLED (not the audit).
#
# Usage:
#   npm run apply:v87-from-omega3              # bundled (default — Mac terminal UI)
#   npm run apply:v87-from-omega3 -- --hosted  # live Base44 CDN
#   npm run apply:v87-from-omega3 -- --no-open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${APPLY_BRANCH:-cursor/apple-privacy-plist-bacf}"
MODE="bundled"
OPEN_XCODE=1
SKIP_SYNC=0

for arg in "$@"; do
  case "$arg" in
    --bundled) MODE="bundled" ;;
    --hosted) MODE="hosted" ;;
    --no-open) OPEN_XCODE=0 ;;
    --skip-sync) SKIP_SYNC=1 ;;
    -h|--help)
      cat << 'EOF'
Apply v87 on top of Omega 3 — gallery + corrections

  npm run apply:v87-from-omega3              Bundled ios/public (default — Mac terminal UI)
  npm run apply:v87-from-omega3 -- --hosted  Live Base44 CDN

Includes since omega-3:
  17af6de  App Store privacy plist
  6c15e97  v82 upload pipeline
  390928b  v83 native-media-input
  5762b16  v87 UI — SignedOutLanding (Find Your Memories + Sign In)
  f1b2505  OAuth on restorebraine.base44.app

Hosted: phone loads https://restorebraine.base44.app
  Gallery UI on phone needs Base44 Publish for src/ changes

Bundled: phone loads capacitor:// ios/public from Mac
  Requires: Delete app → Restart iPhone → Clean → Run every build

audit:v87-improvements is read-only — safe to run, does not cause regression
EOF
      exit 0
      ;;
  esac
done

banner() {
  echo
  echo "══════════════════════════════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════════════════════════════"
}

wipe_build_debris() {
  git clean -fd -- dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true
  rm -rf ios/App/Pods ios/App/Podfile.lock 2>/dev/null || true
}

banner "APPLY v87 FROM OMEGA 3 — mode: $MODE"

if [[ "$MODE" == "hosted" ]]; then
  echo " Hosted mode — phone loads live Base44 CDN"
  echo
fi

if [[ "$MODE" == "bundled" ]]; then
  echo " Bundled mode — Mac terminal pushes UI to iPhone (ios/public)"
  echo
fi

if [[ "$SKIP_SYNC" != "1" ]]; then
  echo "==> [1] Sync branch"
  OLD_MODE="unknown"
  if grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
    OLD_MODE="hosted"
  else
    OLD_MODE="bundled"
  fi
  if [[ "$OLD_MODE" != "unknown" && "$OLD_MODE" != "$MODE" ]]; then
    echo ""
    echo " ⚠  MODE SWITCH: ${OLD_MODE} → ${MODE}"
    echo "    Phone will load a DIFFERENT UI layer — may look like regression or white screen"
    echo "    Required: Delete app → Restart iPhone → Xcode Clean → Run"
    echo ""
  fi
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  npm install
else
  echo "==> [1] Skip sync (--skip-sync)"
fi

echo
echo "==> [2] Port Omega 3 gallery stack (persistence + multi-batch organize)"
node scripts/port-omega3-gallery-to-v87.mjs

if [[ "$MODE" == "hosted" ]]; then
  echo
  echo "==> [3] Hosted Capacitor shell (v87 baseline — loads live Base44)"
  node scripts/write-build-info.mjs
  node scripts/use-local-native-bundle.mjs --hosted
  npx cap sync ios

  echo
  echo "==> [4] Ghost blocklist sync"
  node scripts/sync-ghost-builds-native.mjs

  echo
  echo "==> [5] CocoaPods"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    (cd ios/App && pod install)
  else
    echo "    (skip pod install — not on macOS)"
  fi
else
  echo
  echo "==> [3] Wipe stale bundled assets (WKWebView ghost risk)"
  wipe_build_debris

  echo
  echo "==> [4] Bundled native build (experimental)"
  npm run build:native-local

  echo
  echo "==> [5] CocoaPods"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    (cd ios/App && pod install)
  else
    echo "    (skip pod install — not on macOS)"
  fi

  echo
  echo "==> [6] Ghost blocklist — allow THIS build, block stale bundles"
  node scripts/sync-ghost-builds-native.mjs
  node scripts/prove-bundled-ghost-safe.mjs
  node scripts/prove-apply-no-ghosts.mjs
fi

echo
echo "==> Verify phone load mode"
node scripts/prove-phone-load.mjs || true

echo
echo "==> Audits (read-only except bundled ghost sync above)"
node scripts/audit-v87-improvements.mjs || true
node scripts/audit-interference.mjs || true
node scripts/audit-pre-build.mjs 2>/dev/null || true
node scripts/diagnose-apply-regression.mjs || true
node scripts/gate-mode-consistency.mjs || true

banner "NEXT ON IPHONE (required every build)"
echo " 1. Delete Restorebraine from iPhone"
echo " 2. Restart iPhone (power off → wait 30s → on)"
echo " 3. Xcode → Product → Clean Build Folder"
echo " 4. Run on iPhone"
echo
if [[ "$MODE" == "hosted" ]]; then
  echo " Phone loads: https://restorebraine.base44.app (HOSTED — reliable)"
  echo " Green bar should NOT say BUNDLED"
  echo
  echo " AUTH FLOW:"
  echo "   1. Signed-out landing — Find Your Memories + Sign In button"
  echo "   2. Tap Sign In → Google OAuth"
  echo "   3. Gallery — Find Your Memories + search (after login)"
  echo
  echo " src/ gallery changes need Base44 Publish: npm run base44:export-pack"
else
  STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo '?')"
  ENTRY="$(grep -oE 'index-[^"]+\.js' ios/App/App/public/index.html 2>/dev/null | head -1 || echo '?')"
  echo " Phone loads: capacitor:// bundled ios/public"
  echo " EXPECTED green bar: BUNDLED · ${STAMP} · ${ENTRY}"
  echo
  echo " AUTH FLOW:"
  echo "   1. Signed-out landing — Find Your Memories + Sign In button"
  echo "   2. Tap Sign In → Google OAuth"
  echo "   3. Gallery — Find Your Memories + search (after login)"
  echo
  echo " If white screen: Delete app → Restart iPhone → Clean → Run (required every build)"
fi
echo "══════════════════════════════════════════════════════════════"

if [[ "$OPEN_XCODE" == "1" && "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || true
fi
