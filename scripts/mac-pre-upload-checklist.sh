#!/usr/bin/env bash
# Run before archiving — confirms brain icon is ready for App Store Connect.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ICON="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]*//g')

echo "=== Restorebraine Pre-Upload Checklist ==="
echo

FAIL=0

BYTES=$(wc -c < "$ICON" | tr -d ' ')
if [ "$BYTES" -lt 500000 ]; then
  echo "FAIL: AppIcon-1024.png is only ${BYTES} bytes (placeholder magnifying glass)"
  echo "      Run: npm run ios:icons"
  FAIL=1
else
  echo "OK: AppIcon-1024.png is ${BYTES} bytes (official brain icon)"
fi

if grep -q 'ios-marketing' ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json; then
  echo "OK: Contents.json has App Store 1024pt (ios-marketing) entry"
else
  echo "FAIL: Contents.json missing ios-marketing entry"
  FAIL=1
fi

if grep -q 'CFBundleIcons' ios/App/App/Info.plist; then
  echo "WARN: Info.plist still has CFBundleIcons — pull latest main"
else
  echo "OK: Info.plist uses asset catalog only"
fi

echo "OK: Build number is $BUILD"
echo

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

cat <<EOF
=== Upload steps (icon appears in App Store Connect AFTER this) ===

The grid placeholder on the Apps page is normal until a build finishes processing.

1. killall Xcode   (optional, if icons look wrong)
2. open ios/App/App.xcworkspace
3. In Xcode: App → Assets.xcassets → AppIcon
   - Bottom slot "App Store iOS 1024pt" must show the BRAIN icon
4. Product → Clean Build Folder
5. Product → Archive
6. Window → Organizer → select archive → Distribute App
7. App Store Connect → Upload → wait for success
8. Wait 15–60 minutes for Apple to process build $BUILD
9. App Store Connect → TestFlight → build $BUILD should show brain icon
10. Apps list icon updates after that build processes

Verify archive before upload:
  bash scripts/mac-verify-archive-icon.sh ~/Library/Developer/Xcode/Archives/<date>/App.xcarchive

EOF
