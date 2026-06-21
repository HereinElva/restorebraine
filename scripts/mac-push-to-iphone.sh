#!/usr/bin/env bash
# Push the verified DerivedData App.app to a connected iPhone (after verify-xcode-app-bundle passes).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Push built App.app to iPhone ==="
echo ""

if ! bash scripts/verify-xcode-app-bundle.sh; then
  echo ""
  echo "Fix Mac bundle first: bash scripts/mac-ios-v4-deploy.sh --no-sync"
  echo "Then Xcode Run (Cmd+R) or re-run this script."
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
if [ -z "$APP" ]; then
  echo "FAIL: No Debug-iphoneos App.app — build in Xcode first (Cmd+R)"
  exit 1
fi

UDID=$(bash scripts/mac-detect-ios-device.sh)
echo "Device: $UDID"
echo "App:    $APP"
echo ""

if xcrun devicectl help device install app >/dev/null 2>&1; then
  echo "Installing via devicectl..."
  if xcrun devicectl device install app --device "$UDID" "$APP"; then
    BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
    ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  INSTALLED on iPhone: v${BUILD_NUM} · ${ENTRY}"
    echo "  Open app → tap purple badge (bottom-left) to confirm on device"
    echo "════════════════════════════════════════════════════════════════"
    exit 0
  fi
  echo "devicectl install failed."
fi

echo ""
echo "Could not install via CLI. Use Xcode Run:"
echo "  1. open ios/App/App.xcworkspace"
echo "  2. Device menu → your iPhone"
echo "  3. Delete Restorebraine from iPhone"
echo "  4. Product → Clean Build Folder"
echo "  5. Product → Run (Cmd+R)"
echo ""
echo "Mac bundle is correct — phone just has not received it yet."
exit 2
