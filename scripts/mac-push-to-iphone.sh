#!/usr/bin/env bash
# Push fresh ios/public bundle to iPhone — copies into App.app first (no Xcode Run required).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Push built App.app to iPhone ==="
echo ""

if [ ! -f ios/App/App/public/index.html ]; then
  echo "FAIL: ios/App/App/public missing — run: npm run build:native-local"
  exit 1
fi

REPO_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
REPO_STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
echo "Repo ready: $REPO_STAMP"
echo "Entry JS:   $REPO_ENTRY"
echo ""

echo "=== Copy ios/public → DerivedData App.app ==="
bash scripts/mac-copy-public-into-appapp.sh
echo ""

if ! bash scripts/verify-xcode-app-bundle.sh; then
  echo ""
  echo "FAIL: App.app still does not match repo after copy."
  exit 1
fi

find_deployed_app() {
  local best="" best_mtime=0 candidate mtime
  while IFS= read -r candidate; do
    case "$candidate" in
      *Index.noindex*) continue ;;
      *Build/Intermediates*) continue ;;
    esac
    [ -f "$candidate/public/index.html" ] || continue
    mtime=$(stat -f '%m' "$candidate" 2>/dev/null || stat -c '%Y' "$candidate" 2>/dev/null || echo 0)
    if [ "$mtime" -gt "$best_mtime" ]; then
      best_mtime=$mtime
      best=$candidate
    fi
  done < <(
    find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' -print 2>/dev/null
  )
  echo "$best"
}

APP=$(find_deployed_app)
UDID=$(bash scripts/mac-detect-ios-device.sh)
echo "Device: $UDID"
echo "App:    $APP"
echo ""

if xcrun devicectl help device install app >/dev/null 2>&1; then
  echo "Installing via devicectl..."
  if xcrun devicectl device install app --device "$UDID" "$APP"; then
    BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  INSTALLED on iPhone: v${BUILD_NUM} · ${REPO_ENTRY}"
    echo "  Login: Restorebraine + Native bundle · v${BUILD_NUM} + Continue with Google"
    echo "  Tap purple badge → v4-core · capacitor://localhost · auth: sign-in-v4"
    echo "════════════════════════════════════════════════════════════════"
    exit 0
  fi
  echo "devicectl install failed."
fi

echo ""
echo "Copy succeeded but install failed. Use Xcode Run (Cmd+R) with iPhone selected."
exit 2
