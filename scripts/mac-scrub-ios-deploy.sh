#!/usr/bin/env bash
# Full deploy scrub: rebuild + wipe Xcode caches + verify instructions.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS deploy scrub ==="
bash scripts/mac-ios-v4-rebuild.sh

echo ""
echo "=== Wiping Xcode DerivedData for App (optional but fixes stale installs) ==="
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "Removing $dir"
  rm -rf "$dir"
done

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
echo "On device: purple badge v{N} · v4-core, js: index-*.js matches Terminal"
