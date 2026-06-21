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
echo "Login screen should show:"
echo "  • Restorebraine + subtitle \"Sign in to access your memories\""
echo "  • Continue with Google · Continue with Apple · email sign-in"
echo "  • Native bundle · v${BUILD_NUM} (purple text, bundled app only)"
echo ""
echo "Tap purple badge → v${BUILD_NUM} · v4-core · capacitor://localhost"
echo ""
echo "If you ONLY see one Google button (no Apple/email), the phone has an old build — re-run this script."
