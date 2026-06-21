#!/usr/bin/env bash
# Run before archiving — confirms app icon + hosted mode for App Store Connect.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

ICON="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]*//g')

cat <<EOF
=== Restorebraine Pre-Upload Checklist ===
=== CRITICAL: use HOSTED mode before Archive (Omega-style) ===

DO NOT upload after mac-ios-v4-deploy or mac-capacitor-web-sync — those bundle
capacitor://localhost and login buttons break on TestFlight.

Before Archive run:
  bash scripts/mac-appstore-deploy.sh

That sets server.url → https://restorebraine.base44.app (same login as Safari).

EOF

echo "=== Icon + version checks ==="
echo

REPO_URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
if [[ "$REPO_URL" == *"restorebraine.base44.app"* ]]; then
  echo "OK: capacitor.config.json is HOSTED (App Store / TestFlight ready)"
else
  echo "FAIL: Repo is bundled localhost — login breaks on TestFlight"
  echo "      Run: bash scripts/mac-appstore-deploy.sh"
  FAIL=1
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
5. Product → Archive
6. Window → Organizer → select archive → Distribute App
7. App Store Connect → Upload → wait for success
8. Wait 15–60 minutes for Apple to process build $BUILD
9. App Store Connect → TestFlight → build $BUILD should show the app logo icon
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
