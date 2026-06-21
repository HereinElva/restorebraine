#!/usr/bin/env bash
# Delete Restorebraine from iPhone, then push fresh App.app from DerivedData.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUNDLE_ID="com.restorebraine.app"
UDID=$(bash scripts/mac-detect-ios-device.sh)

echo "=== Reinstall Restorebraine on iPhone ==="
echo "Device: $UDID"
echo ""

if xcrun devicectl help device uninstall app >/dev/null 2>&1; then
  echo "Uninstalling old app..."
  xcrun devicectl device uninstall app --device "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  echo "Waiting for iOS to remove app..."
  sleep 2
else
  echo "Delete Restorebraine from the iPhone manually, then press Enter."
  read -r _
fi

bash scripts/mac-push-to-iphone.sh

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
echo ""
echo "On login screen you MUST see purple text:"
echo "  Native bundle · v${BUILD_NUM}"
echo ""
echo "If you see 'Sign in to access your memories' instead, you are NOT in the bundled app."
echo "Tap purple badge → v${BUILD_NUM} · v4-core · capacitor://localhost"
