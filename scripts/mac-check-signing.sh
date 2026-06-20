#!/usr/bin/env bash
# Check whether Xcode signing is configured for device builds on THIS Mac.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

PBX="ios/App/App.xcodeproj/project.pbxproj"
RESOLVED=$(bash scripts/mac-resolve-development-team.sh 2>/dev/null || echo "")
AVAILABLE=$(bash scripts/mac-list-development-teams.sh --ids-only 2>/dev/null || true)

echo "=== Restorebraine signing check ==="
echo ""

if [ -n "$AVAILABLE" ]; then
  echo "Teams in keychain (signed-in Xcode accounts):"
  while IFS= read -r team; do
    [ -n "$team" ] || continue
    marker=" "
    if [ "$team" = "$RESOLVED" ]; then marker="→"; fi
    echo "  $marker $team"
  done <<< "$AVAILABLE"
  echo ""
else
  echo "WARNING: No Apple Development certificate in keychain."
  echo ""
  echo "Fix (one time):"
  echo "  1. Xcode → Settings → Accounts → + → sign in with your Apple ID"
  echo "  2. Select Apple ID → Manage Certificates → + → Apple Development"
  echo "  3. open ios/App/App.xcworkspace → App target → Signing & Capabilities → Team"
  echo ""
fi

if grep -q 'DEVELOPMENT_TEAM = [A-Z0-9]' "$PBX" 2>/dev/null; then
  PBX_TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' "$PBX" | sed 's/.*= //;s/;//;s/ //g')
  echo "Project DEVELOPMENT_TEAM: $PBX_TEAM"
else
  echo "MISSING: No DEVELOPMENT_TEAM in project.pbxproj"
fi

if [ -n "$RESOLVED" ]; then
  echo "CLI will use team: $RESOLVED"
  if [ -n "$AVAILABLE" ] && ! echo "$AVAILABLE" | grep -qx "$RESOLVED"; then
    echo ""
    echo "ERROR: Team $RESOLVED is not available on this Mac."
    echo "  Sign into Xcode with that Apple ID, or run:"
    echo "  RESTOREBRAINE_DEVELOPMENT_TEAM=YOUR_TEAM_ID bash scripts/mac-ios-v4-install.sh"
    echo ""
    echo "List teams: bash scripts/mac-list-development-teams.sh"
    exit 1
  fi
  if [ -n "$AVAILABLE" ]; then
    echo "OK: Team $RESOLVED can sign on this Mac."
  fi
else
  echo "MISSING: Could not resolve DEVELOPMENT_TEAM"
fi

echo ""
echo "Test deploy without device signing (Simulator):"
echo "  bash scripts/mac-xcode-build-simulator.sh"
