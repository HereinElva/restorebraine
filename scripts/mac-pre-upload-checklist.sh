#!/usr/bin/env bash
# Run before archiving — confirms app icon + hosted mode for App Store Connect.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

ICON="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]*//g')

cat <<EOF
=== Restorebraine 1.0.1 Pre-Upload Checklist ===

Build with:
  bash scripts/mac-build.sh

Bundled (default): full app on iPhone — no Base44 needed.
Hosted (--hosted): Omega shell → restorebraine.base44.app

EOF

echo "=== Icon + version checks ==="
echo

BUNDLED=0
HOSTED=0
REPO_URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
if [[ "$REPO_URL" == *"restorebraine.base44.app"* ]]; then
  HOSTED=1
  echo "OK: capacitor.config.json is HOSTED (Omega shell)"
elif [ ! -f ios/App/App/capacitor.config.json ] || ! grep -q '"url"' ios/App/App/capacitor.config.json 2>/dev/null; then
  BUNDLED=1
  echo "OK: capacitor.config.json is BUNDLED (full 1.0.1 app — recommended)"
else
  echo "WARN: unexpected capacitor.config.json server.url: $REPO_URL"
fi

BYTES=$(wc -c < "$ICON" | tr -d ' ')
if [ "$BYTES" -lt 500000 ]; then
  echo "FAIL: AppIcon-1024.png is only ${BYTES} bytes (placeholder — not the official icon)"
  echo "      Run: npm run ios:icons"
  FAIL=1
else
  echo "OK: AppIcon-1024.png is ${BYTES} bytes (official Restorebraine app icon)"
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
   - Bottom slot "App Store iOS 1024pt" must show the Restorebraine app logo
     (gradient gallery icon — NOT a brain, NOT a grid placeholder)
4. Product → Clean Build Folder
5. Product → Run (Cmd+R) once — build log MUST show:
     Restorebraine DEPLOY OK: public/ -> App.app
     FULL REPLACE: copied ... files into App.app/public
6. Product → Archive
7. Window → Organizer → select archive → Distribute App
8. App Store Connect → Upload → wait for success
9. Wait 15–60 minutes for Apple to process build $BUILD
10. App Store Connect → TestFlight → build $BUILD should show the app logo icon
10. Apps list icon updates after build is linked on Distribution tab (see below)

=== App Store Connect (after TestFlight shows Complete) ===

The Apps page grid placeholder is normal until a build finishes processing.

1. App Store Connect → Restorebraine
2. Click **Distribution** tab (not TestFlight)
3. iOS App → **1.0.1 Prepare for Submission**
4. Under **Build**, click **+** and select your newest build ($BUILD or latest)
5. Click **Save**
6. Wait up to 24 hours — Apps list + store listing icon pull from linked build

Check TestFlight build icon: open your build — does it show the app logo or a grid?
- App logo on build → linking on Distribution tab fixes Apps page
- Grid on build → re-run npm run ios:icons, Clean, Archive, upload again

EOF
