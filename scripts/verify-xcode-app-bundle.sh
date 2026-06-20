#!/usr/bin/env bash
# After Xcode Run: verify the built App.app contains the same bundle as repo (proves deploy worked).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

REPO_STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
REPO_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)

APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*Build/Products/*-iphoneos/*' -print 2>/dev/null | head -1)
if [ -z "$APP" ]; then
  APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*Build/Products/*-iphonesimulator/*' -print 2>/dev/null | head -1)
fi

echo "=== Verify installed App.app bundle ==="
echo "Repo BUILD_STAMP: $REPO_STAMP"
echo "Repo entry JS:    $REPO_ENTRY"
echo ""

if [ -z "$APP" ]; then
  echo "FAIL: No App.app in DerivedData — build in Xcode first (Cmd+R)"
  exit 1
fi

echo "Found: $APP"
APP_STAMP=$(tr -d '\n' < "$APP/BUILD_STAMP.txt" 2>/dev/null || echo missing)
APP_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "$APP/public/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)
URL_IN_CONFIG=$(grep -c '"url"' "$APP/capacitor.config.json" 2>/dev/null || echo 0)

echo "App BUILD_STAMP:  $APP_STAMP"
echo "App entry JS:     $APP_ENTRY"
echo "server.url count: $URL_IN_CONFIG (must be 0 for v4-core)"
echo ""

FAIL=0
[ "$REPO_STAMP" = "$APP_STAMP" ] || { echo "FAIL: BUILD_STAMP mismatch — Xcode did not copy fresh bundle"; FAIL=1; }
[ "$REPO_ENTRY" = "$APP_ENTRY" ] || { echo "FAIL: entry JS mismatch — stale public/ in App.app"; FAIL=1; }
[ "$URL_IN_CONFIG" = "0" ] || { echo "FAIL: server.url set — app loads hosted site not bundle"; FAIL=1; }
[ -f "$APP/public/assets/$APP_ENTRY" ] || { echo "FAIL: entry file missing inside App.app"; FAIL=1; }

if [ "$FAIL" -eq 0 ]; then
  echo "OK: App.app matches repo — device should show v4-core updates"
else
  echo ""
  echo "Fix: delete app -> Xcode Clean Build Folder -> check build log for 'Restorebraine DEPLOY OK'"
  echo "     bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi
