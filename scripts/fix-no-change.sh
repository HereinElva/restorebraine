#!/usr/bin/env bash
# fix-no-change.sh — one Mac command when iPhone UI still shows "no change"
#
# Default: BUNDLED mode (phone UI from Mac/ios/public — NOT Base44 CDN)
#
# Usage:
#   npm run fix:no-change
#   npm run fix:no-change -- --hosted
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="bundled"
for arg in "$@"; do
  case "$arg" in
    --hosted) MODE="hosted" ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " FIX NO-CHANGE — mode: $MODE"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1/5] Sync branch + install"
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install

echo
echo "==> [2/5] Clear blockers + rebuild"
if [[ "$MODE" == "hosted" ]]; then
  npm run blocks:clear -- --hosted
else
  npm run blocks:clear
fi

echo
echo "==> [3/5] Verify build actually completed"
if [[ "$MODE" == "bundled" ]]; then
  if grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
    echo ""
    echo "✗ BUILD FAILED — ios config still has server.url (hosted mode)"
    echo "  Phone will load Base44 CDN — Mac changes will NOT appear."
    echo "  Re-run: npm run build:native-local"
    echo "  If icons fail, run: npm install"
    exit 1
  fi
  node scripts/verify-bundled-v87.mjs
fi

echo
echo "==> [4/5] Audit"
node scripts/audit-interference.mjs || true
node scripts/prove-phone-load.mjs || true

echo
echo "==> [5/5] REQUIRED on iPhone (every time — skip = no change)"
echo "  1. Delete Restorebraine from iPhone"
echo "  2. Restart iPhone (power off → wait 30s → on)"
echo "  3. Xcode → Product → Clean Build Folder"
echo "  4. Run on iPhone"
echo
if [[ "$MODE" == "bundled" ]]; then
  STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo '?')"
  ENTRY="$(grep -oE 'index-[^"]+\.js' ios/App/App/public/index.html 2>/dev/null | head -1 || echo '?')"
  echo " PROOF: green bar at bottom of app must show:"
  echo "   BUNDLED · ${STAMP} · ${ENTRY}"
  echo ""
  echo " If bar says HOSTED or old stamp → build did not reach phone (repeat steps above)"
else
  echo " Hosted: phone loads https://restorebraine.base44.app"
  echo " UI changes need Base44 Publish: npm run base44:export-pack"
fi
echo "══════════════════════════════════════════════════════════════"
