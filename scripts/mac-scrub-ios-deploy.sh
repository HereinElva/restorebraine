#!/usr/bin/env bash
# Full deploy scrub: rebuild + wipe Xcode caches + verify instructions.
# For stubborn stale installs use: bash scripts/mac-nuclear-scrub.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS deploy scrub ==="
bash scripts/mac-ios-v4-rebuild.sh

echo ""
echo "=== Wiping Xcode DerivedData for App ==="
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "Removing $dir"
  rm -rf "$dir"
done

echo "Touching ios/App/App/public (force Xcode to see changes)..."
find ios/App/App/public -type f -exec touch {} + 2>/dev/null || true

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo '?')

echo ""
echo "=== Still no change on device? Run nuclear scrub ==="
echo "  bash scripts/mac-nuclear-scrub.sh"
echo ""
echo "=== Next in Xcode ==="
echo "1. Quit Xcode completely (Cmd+Q)"
echo "2. open ios/App/App.xcworkspace"
echo "3. Delete Restorebraine from device"
echo "4. Product -> Clean Build Folder"
echo "5. Run (Cmd+R)"
echo "6. Build log MUST show: Restorebraine DEPLOY OK"
echo "7. Then run: bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "On device: purple badge v${BUILD_NUM} · v4-core, js: ${ENTRY}"
