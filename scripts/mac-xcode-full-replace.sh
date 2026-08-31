#!/usr/bin/env bash
# Full wipe + rebuild + force Xcode to replace the ENTIRE web bundle on next Run/Archive.
#
# This restores the old behavior: every Xcode build runs xcode-copy-public-bundle.sh
# which deletes App.app/public/ completely and ditto-copies the fresh ios/public/ tree.
# Use before App Store Archive when nothing seems to change on device.
#
# Usage:
#   bash scripts/mac-xcode-full-replace.sh              # App Store hosted (default)
#   bash scripts/mac-xcode-full-replace.sh --bundled    # dev bundled localhost only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE=hosted
for arg in "$@"; do
  case "$arg" in
    --bundled) MODE=bundled ;;
    --hosted) MODE=hosted ;;
    -h|--help)
      echo "Usage: bash scripts/mac-xcode-full-replace.sh [--hosted|--bundled]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Xcode FULL REPLACE — wipe everything, rebuild, fresh copy   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Mode: ${MODE}"
echo "On next Xcode Run/Archive, build log MUST show:"
echo "  Restorebraine DEPLOY OK: public/ -> App.app"
echo "That line means public/ was deleted and entirely re-copied into App.app."
echo ""

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "Quitting Xcode so DerivedData can be wiped..."
  osascript -e 'quit app "Xcode"' 2>/dev/null || killall Xcode 2>/dev/null || true
  sleep 2
fi

echo "=== Step 1: wipe dist, vite cache, ios/public ==="
rm -rf dist node_modules/.vite ios/App/App/public
mkdir -p ios/App/App/public/assets

echo "=== Step 2: wipe Xcode DerivedData for this app ==="
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "  removing $dir"
  rm -rf "$dir"
done

echo "=== Step 3: full rebuild ==="
if [ "$MODE" = "bundled" ]; then
  npm run build:native-local
else
  node scripts/sync-build-numbers.mjs
  node scripts/use-local-native-bundle.mjs --hosted
  npm run build:web
  bash scripts/mac-fix-build-stamp.sh
  node scripts/cap-merge-web-into-ios.mjs
fi

if [ ! -f ios/App/App/public/index.html ]; then
  echo "FAIL: ios/App/App/public/index.html missing after build"
  exit 1
fi

ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
FILE_COUNT=$(find ios/App/App/public -type f | wc -l | tr -d ' ')
BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo unknown)

echo "=== Step 4: touch every file (force Xcode to see changes) ==="
find ios/App/App/public -type f -exec touch {} + 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  FULL REPLACE READY — v${BUILD_NUM} · ${FILE_COUNT} files · ${ENTRY}"
echo "  BUILD_STAMP: ${STAMP}"
echo "════════════════════════════════════════════════════════════════"
echo ""
if [ "$MODE" = "hosted" ]; then
  echo "Hosted mode: app loads https://restorebraine.base44.app (login = Safari)."
  echo "Publish Base44 first if login UI changed: base44-publish-v*.txt"
  echo ""
fi
echo "NOW in Xcode:"
echo "  1. open ios/App/App.xcworkspace"
echo "  2. Product → Clean Build Folder (Shift+Cmd+K)"
echo "  3. Product → Run (Cmd+R) OR Product → Archive"
echo ""
echo "In Report navigator, search last build for:"
echo "  Restorebraine DEPLOY OK"
echo ""
echo "You should also see in the log:"
echo "  FULL REPLACE: removed .../App.app/public"
echo "  FULL REPLACE: copied ${FILE_COUNT} files into App.app"
echo ""
echo "Verify installed bundle:"
echo "  bash scripts/verify-xcode-app-bundle.sh"
if [ "$MODE" = "hosted" ]; then
  echo "  bash scripts/verify-hosted-app-bundle.sh"
fi
echo ""
