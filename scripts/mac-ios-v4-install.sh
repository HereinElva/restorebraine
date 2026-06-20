#!/usr/bin/env bash
# Install v4 bundle to connected iPhone: scrub DerivedData, xcodebuild, devicectl install, verify.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ ! -f ios/App/App/public/index.html ]; then
  echo "error: ios/App/App/public missing — run: bash scripts/mac-ios-v4-build.sh"
  exit 1
fi

WS="ios/App/App.xcworkspace"
SCHEME="App"
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

echo "=== Restorebraine v4 INSTALL to iPhone ==="
TEAM=$(bash scripts/mac-resolve-development-team.sh)
echo "Development team: $TEAM"
bash scripts/mac-ensure-development-team.sh
if ! bash scripts/mac-check-signing.sh; then
  echo ""
  echo "Fix signing in Xcode, then re-run:"
  echo "  bash scripts/mac-ios-v4-install.sh"
  exit 1
fi
echo ""
UDID=$(bash scripts/mac-detect-ios-device.sh)
echo "Device UDID: $UDID"
echo ""

echo "=== Wiping Xcode DerivedData for App ==="
find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "Removing $dir"
  rm -rf "$dir"
done

echo "Touching ios/App/App/public ..."
find ios/App/App/public -type f -exec touch {} + 2>/dev/null || true

LOG="/tmp/restorebraine-v4-install.log"
echo "=== xcodebuild → device (log: $LOG) ==="

set +e
xcodebuild \
  -workspace "$WS" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "platform=iOS,id=$UDID" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  build 2>&1 | tee "$LOG"
XCODE_EXIT=${PIPESTATUS[0]}
set -e

if [ "$XCODE_EXIT" -ne 0 ]; then
  if grep -qE 'requires a development team|No Account for Team|No profiles for' "$LOG"; then
    echo ""
    echo "ERROR: Signing failed — Xcode cannot use team $TEAM on this Mac."
    echo ""
  if grep -q 'No Account for Team' "$LOG"; then
      echo "  The Apple ID for team $TEAM is NOT in Xcode → Settings → Accounts."
      echo "  (A keychain certificate alone is not enough for CLI xcodebuild.)"
      echo ""
      echo "Fix:"
      echo "  bash scripts/mac-open-signing-fix.sh"
      echo ""
      echo "  Or manually:"
      echo "  1. Xcode → Settings → Accounts → + → sign in Apple ID for team $TEAM"
      echo "  2. open ios/App/App.xcworkspace → App → Signing & Capabilities → Team"
      echo "  3. Product → Run (Cmd+R) — creates provisioning profile on first run"
    else
      echo "Fix in Xcode (one time):"
      echo "  open ios/App/App.xcworkspace"
      echo "  App target → Signing & Capabilities → Team → your Apple ID"
      echo "  Product → Run (Cmd+R)"
    fi
    echo ""
    echo "Override team ID:"
    echo "  RESTOREBRAINE_DEVELOPMENT_TEAM=YOUR_TEAM_ID bash scripts/mac-ios-v4-install.sh"
    exit 1
  fi
  echo "ERROR: xcodebuild failed (exit $XCODE_EXIT) — see $LOG"
  exit 1
fi

if ! grep -q 'Restorebraine DEPLOY OK' "$LOG"; then
  echo ""
  echo "ERROR: Build log missing 'Restorebraine DEPLOY OK' — bundle was NOT copied into App.app"
  echo "  Check Restorebraine Copy Public Bundle phase in Xcode build log"
  exit 1
fi

echo ""
echo "OK: Restorebraine DEPLOY OK in build log"

# Find the real App.app (not Index.noindex hollow shell)
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
    find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*' -print 2>/dev/null
  )
  echo "$best"
}

APP=$(find_deployed_app)
if [ -z "$APP" ]; then
  echo "ERROR: App.app with public/ not found in DerivedData after build"
  exit 1
fi

echo "App bundle: $APP"

# Push .app to device (Xcode Run does this implicitly; CLI needs devicectl or ios-deploy)
INSTALLED=0
if xcrun devicectl help device install app >/dev/null 2>&1; then
  echo ""
  echo "=== devicectl install app ==="
  if xcrun devicectl device install app --device "$UDID" "$APP"; then
    INSTALLED=1
  else
    echo "WARNING: devicectl install failed — use Xcode Run (Cmd+R) to install"
  fi
elif command -v ios-deploy >/dev/null 2>&1; then
  echo ""
  echo "=== ios-deploy ==="
  if ios-deploy --id "$UDID" --bundle "$APP" --justlaunch; then
    INSTALLED=1
  else
    echo "WARNING: ios-deploy failed — use Xcode Run (Cmd+R)"
  fi
else
  echo ""
  echo "NOTE: devicectl / ios-deploy not available."
  echo "  App.app is built and bundle-copied. Install with Xcode: Product → Run (Cmd+R)"
fi

echo ""
if ! bash scripts/verify-xcode-app-bundle.sh; then
  exit 1
fi

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')

echo ""
echo "════════════════════════════════════════════════════════════════"
if [ "$INSTALLED" = "1" ]; then
  echo "  INSTALLED on iPhone: v${BUILD_NUM} · ${ENTRY}"
else
  echo "  BUILT for iPhone — press Run in Xcode if app did not launch"
  echo "  Expected on device: deploy v${BUILD_NUM} · ${ENTRY}"
fi
echo "════════════════════════════════════════════════════════════════"
