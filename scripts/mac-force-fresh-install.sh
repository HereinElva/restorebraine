#!/usr/bin/env bash
# One command when iPhone still shows old UI (v199 badge, Sign in instead, etc.)
#
# Root cause: ios/App/App/public/ is gitignored — git pull does NOT replace it.
# This script wipes the stale bundle, rebuilds v204+, and clears Xcode caches.
#
# Usage:
#   bash scripts/mac-force-fresh-install.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  FORCE FRESH INSTALL — wipe stale bundle + rebuild           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "=== Wiping stale bundle (gitignored — this is why v199 persists) ==="
rm -rf ios/App/App/public dist node_modules/.vite
mkdir -p ios/App/App/public/assets

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "Quitting Xcode..."
  osascript -e 'quit app "Xcode"' 2>/dev/null || killall Xcode 2>/dev/null || true
  sleep 2
fi

find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "Removing DerivedData: $dir"
  rm -rf "$dir"
done

bash scripts/mac-xcode-full-replace.sh --bundled

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
IOS_DEPLOY=$(grep -o 'content="v[0-9]*"' ios/App/App/public/index.html | head -1 | tr -d '"' | sed 's/content=//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')

node scripts/verify-ios-bundle-version.mjs

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Fresh bundle ready: v${BUILD_NUM} · ${ENTRY} · ${IOS_DEPLOY}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "NOW:"
echo "  1. Delete Restorebraine from iPhone (long-press → Remove App)"
echo "  2. open ios/App/App.xcworkspace"
echo "  3. Product → Clean Build Folder (Shift+Cmd+K)"
echo "  4. Product → Run (Cmd+R)"
echo ""
echo "Build log MUST show:"
echo "  Restorebraine DEPLOY OK"
echo "  entry: ${ENTRY}"
echo ""
echo "After install, index.html meta restorebraine-deploy must say v${BUILD_NUM}"
echo "(No v199 badge, no Sign in instead, gallery loads without pull-down)"
echo ""

open ios/App/App.xcworkspace 2>/dev/null || true
