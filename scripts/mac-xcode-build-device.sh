#!/usr/bin/env bash
# Build App.app from Terminal (same as Xcode Run build phase, including copy script).
# Use when verify keeps failing but you want to confirm the deploy pipeline works.
#
# After success: install to iPhone still requires Xcode Run, OR use ios-deploy if installed.
# This at least proves Restorebraine DEPLOY OK and lets verify-xcode-app-bundle.sh pass.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

WS="ios/App/App.xcworkspace"
SCHEME="App"

if [ ! -d "$WS" ]; then
  echo "error: $WS missing"
  exit 1
fi

if [ ! -f ios/App/App/public/index.html ]; then
  echo "error: ios/App/App/public missing — run: bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi

echo "=== xcodebuild: $SCHEME (iphoneos Debug) ==="
echo "This builds App.app and runs Restorebraine Copy Public Bundle."
echo ""

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

xcodebuild \
  -workspace "$WS" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  build \
  | tee /tmp/restorebraine-xcodebuild.log

echo ""
if grep -q 'Restorebraine DEPLOY OK' /tmp/restorebraine-xcodebuild.log; then
  echo "OK: Restorebraine DEPLOY OK found in build log"
else
  echo "WARNING: Restorebraine DEPLOY OK not found — check /tmp/restorebraine-xcodebuild.log"
fi

echo ""
bash scripts/mac-list-app-bundles.sh
echo ""
bash scripts/verify-xcode-app-bundle.sh
