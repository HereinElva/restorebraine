#!/usr/bin/env bash
# apply-v87-from-omega3.sh — Omega 3 gallery + v87 corrections
#
# Default: HOSTED (v87 baseline — reliable on iPhone, no white screen)
# Bundled (experimental): npm run apply:v87-from-omega3 -- --bundled
#
# Usage:
#   npm run apply:v87-from-omega3              # hosted (recommended)
#   npm run apply:v87-from-omega3 -- --bundled # Mac UI without Base44 Publish
#   npm run apply:v87-from-omega3 -- --no-open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${APPLY_BRANCH:-cursor/apple-privacy-plist-bacf}"
MODE="hosted"
OPEN_XCODE=1

for arg in "$@"; do
  case "$arg" in
    --bundled) MODE="bundled" ;;
    --hosted) MODE="hosted" ;;
    --no-open) OPEN_XCODE=0 ;;
    -h|--help)
      cat << 'EOF'
Apply v87 on top of Omega 3 — gallery + corrections

  npm run apply:v87-from-omega3              Hosted (default — v87 baseline, no white screen)
  npm run apply:v87-from-omega3 -- --bundled Bundled ios/public (experimental — white screen risk)

Includes since omega-3 (f58a80d):
  17af6de  App Store privacy plist (5.1.1)
  6c15e97  v82 compact AI consent + fast upload
  390928b  v83 native-media-input for iOS upload picker
  5762b16  v87 UI — SignedOutLanding
  f1b2505  OAuth on restorebraine.base44.app

Hosted: phone loads https://restorebraine.base44.app (gallery UI needs Base44 Publish)
Bundled: phone loads capacitor:// (Mac terminal UI — frequent white screen)

After either: Delete app → Restart iPhone → Xcode Clean Build Folder → Run
EOF
      exit 0
      ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " APPLY v87 FROM OMEGA 3 — mode: $MODE"
echo "══════════════════════════════════════════════════════════════"
echo

if [[ "$MODE" == "bundled" ]]; then
  echo " ⚠  BUNDLED mode — white screen risk on iPhone (v92–v99 post-mortem)"
  echo "    Prefer hosted (default): npm run apply:v87-from-omega3"
  echo
  OPEN_XCODE="$OPEN_XCODE" TERMINAL_REVERT_MODE=bundled-v87 bash scripts/terminal-revert-all.sh --bundled-v87 --no-open
else
  echo "==> [1/6] Sync branch"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  npm install

  echo
  echo "==> [2/6] Port Omega 3 gallery stack (persistence + multi-batch organize)"
  node scripts/port-omega3-gallery-to-v87.mjs

  echo
  echo "==> [3/6] Hosted Capacitor shell (v87 baseline — loads live Base44)"
  node scripts/write-build-info.mjs
  node scripts/use-local-native-bundle.mjs --hosted
  npx cap sync ios

  echo
  echo "==> [4/6] Ghost blocklist sync"
  node scripts/sync-ghost-builds-native.mjs

  echo
  echo "==> [5/6] CocoaPods"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    (cd ios/App && pod install)
  else
    echo "    (skip pod install — not on macOS)"
  fi

  echo
  echo "==> [6/6] Verify"
  node scripts/prove-phone-load.mjs || true
fi

echo
echo "==> Audit summary"
node scripts/audit-v87-improvements.mjs || true

echo
echo "══════════════════════════════════════════════════════════════"
if [[ "$MODE" == "hosted" ]]; then
  echo " Phone loads: https://restorebraine.base44.app (hosted — reliable)"
  echo " Gallery UI changes need Base44 Publish: npm run base44:export-pack"
else
  echo " Phone loads: capacitor:// bundled ios/public"
  echo " If white screen: npm run fix:no-change  (restores hosted)"
fi
echo " NEXT: Delete app → Restart iPhone → Clean Build Folder → Run"
echo "══════════════════════════════════════════════════════════════"

if [[ "$OPEN_XCODE" == "1" && "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || true
fi
