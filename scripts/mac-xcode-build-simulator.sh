#!/usr/bin/env bash
# Build App.app for Simulator — no Apple Developer Team required.
# Proves Restorebraine Copy Public Bundle works; use mac-xcode-build-device after signing is set.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

WS="ios/App/App.xcworkspace"
SCHEME="App"
LOG=/tmp/restorebraine-xcodebuild-sim.log

if [ ! -f ios/App/App/public/index.html ]; then
  echo "error: ios/App/App/public missing — run: bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi

echo "=== xcodebuild: $SCHEME (iphonesimulator Debug) ==="
echo "No signing team needed — use this to confirm DEPLOY OK while fixing device signing."
echo ""

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

xcodebuild \
  -workspace "$WS" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build 2>&1 | tee "$LOG"

echo ""
if grep -q 'Restorebraine DEPLOY OK' "$LOG"; then
  echo "OK: Restorebraine DEPLOY OK — bundle copy pipeline works"
else
  if grep -q 'requires a development team' "$LOG"; then
    echo "ERROR: Signing still required — unusual for simulator; check Xcode project settings"
  else
    echo "WARNING: Restorebraine DEPLOY OK not found — see $LOG"
  fi
fi

echo ""
bash scripts/mac-list-app-bundles.sh 2>/dev/null || true
echo ""
bash scripts/verify-xcode-app-bundle.sh 2>/dev/null || true
