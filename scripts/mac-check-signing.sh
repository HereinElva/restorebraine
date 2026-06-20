#!/usr/bin/env bash
# Check whether Xcode signing is configured for device builds.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

PBX="ios/App/App.xcodeproj/project.pbxproj"

echo "=== Restorebraine signing check ==="
echo ""

if grep -q 'DEVELOPMENT_TEAM = [A-Z0-9]' "$PBX" 2>/dev/null; then
  TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' "$PBX" | sed 's/.*= //;s/;//;s/ //g')
  echo "OK: DEVELOPMENT_TEAM set in project ($TEAM)"
else
  echo "MISSING: No DEVELOPMENT_TEAM in project.pbxproj"
  echo ""
  echo "This is why xcodebuild fails with:"
  echo "  Signing for App requires a development team"
  echo ""
  echo "Fix in Xcode (one time):"
  echo "  1. open ios/App/App.xcworkspace"
  echo "  2. Project navigator -> App (blue) -> TARGETS App"
  echo "  3. Signing & Capabilities tab"
  echo "  4. Enable 'Automatically manage signing'"
  echo "  5. Team -> select your Apple ID"
  echo "     (Xcode -> Settings -> Accounts -> + if no team listed)"
  echo "  6. Repeat for Debug if needed — Xcode saves Team to project.pbxproj"
  echo ""
  echo "Free Apple ID works for testing on your own iPhone."
  echo ""
  echo "After setting Team: Product -> Run (Cmd+R) to iPhone"
fi

echo ""
echo "Test deploy without device signing (Simulator):"
echo "  bash scripts/mac-xcode-build-simulator.sh"
