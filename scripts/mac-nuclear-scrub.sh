#!/usr/bin/env bash
# Nuclear scrub when normal deploy scrub still shows "no change" on device.
# Wipes ALL Xcode/WebKit/Simulator caches, rebuilds from zero, reinstalls clean.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=========================================="
echo "  Restorebraine NUCLEAR iOS deploy scrub"
echo "=========================================="
echo ""

# 1. Kill Xcode + Simulator (releases file locks)
if pgrep -x Xcode >/dev/null 2>&1; then
  echo "Quitting Xcode..."
  osascript -e 'quit app "Xcode"' 2>/dev/null || killall Xcode 2>/dev/null || true
  sleep 2
fi
if pgrep -x Simulator >/dev/null 2>&1; then
  echo "Quitting Simulator..."
  killall Simulator 2>/dev/null || true
  sleep 1
fi

# 2. Ensure correct branch
CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
if [ "$CURRENT" != "$BRANCH" ]; then
  echo "Switching to $BRANCH ..."
  git fetch origin "$BRANCH"
  git checkout -f -B "$BRANCH" "origin/$BRANCH"
fi

# 3. Wipe all local build artifacts
echo "Wiping dist, vite cache, ios/public ..."
rm -rf dist node_modules/.vite ios/App/App/public
mkdir -p ios/App/App/public/assets

# 4. Wipe ALL DerivedData (not just App-*)
echo "Wiping ALL Xcode DerivedData ..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true

# 5. WebKit + Xcode caches
echo "Wiping WebKit and Xcode caches ..."
rm -rf ~/Library/Caches/com.apple.dt.Xcode 2>/dev/null || true
rm -rf ~/Library/Caches/org.webkit.WebKit.Networking 2>/dev/null || true
rm -rf ~/Library/Developer/CoreSimulator/Caches 2>/dev/null || true

# 6. Uninstall app from booted simulator (ignore errors on physical device workflow)
if xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
  echo "Uninstalling Restorebraine from booted simulator ..."
  xcrun simctl uninstall booted com.restorebraine.app 2>/dev/null || true
fi

# 7. Fresh CocoaPods
echo "Reinstalling CocoaPods ..."
cd ios/App
pod install --repo-update 2>/dev/null || pod install
cd ../..

# 8. Full native rebuild
echo ""
echo "=== Full v4-core rebuild ==="
bash scripts/mac-ios-v4-rebuild.sh "$BRANCH"

# 9. Touch every file in public so Xcode sees changes
echo "Touching ios/App/App/public for Xcode ..."
find ios/App/App/public -type f -exec touch {} + 2>/dev/null || true

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt)

echo ""
echo "=========================================="
echo "  NUCLEAR SCRUB DONE — v${BUILD_NUM}"
echo "  BUILD_STAMP: ${STAMP}"
echo "  entry: ${ENTRY}"
echo "=========================================="
echo ""
echo "NOW do this EXACTLY:"
echo "  1. open ios/App/App.xcworkspace"
echo "  2. Product -> Clean Build Folder (Shift+Cmd+K)"
echo "  3. Select your iPhone (not 'My Mac' or old simulator)"
echo "  4. Run (Cmd+R)"
echo ""
echo "In Xcode Report navigator (last build), search for:"
echo "  Restorebraine DEPLOY OK"
echo "  If MISSING — build failed to copy bundle. Screenshot and share."
echo ""
echo "After Run:"
echo "  bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "On device badge must show:"
echo "  v${BUILD_NUM} · v4-core"
echo "  js: ${ENTRY}"
echo "  html: kbrown v4-core v${BUILD_NUM}"
echo ""
echo "If html/js lines are OLD — device still stale. Delete app manually, Run again."
