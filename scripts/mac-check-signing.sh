#!/usr/bin/env bash
# Check whether Xcode signing is configured for device builds on THIS Mac.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

PBX="ios/App/App.xcodeproj/project.pbxproj"
BUNDLE_ID="com.restorebraine.app"
RESOLVED=$(bash scripts/mac-resolve-development-team.sh 2>/dev/null || echo "")
KEYCHAIN_TEAMS=$(bash scripts/mac-list-development-teams.sh --ids-only 2>/dev/null || true)
XCODE_TEAMS=$(bash scripts/mac-list-xcode-account-teams.sh --ids-only 2>/dev/null || true)

fail=0

echo "=== Restorebraine signing check ==="
echo ""

echo "Keychain certificates (may exist without Xcode account):"
if [ -n "$KEYCHAIN_TEAMS" ]; then
  while IFS= read -r team; do
    [ -n "$team" ] || continue
    echo "  · $team"
  done <<< "$KEYCHAIN_TEAMS"
else
  echo "  (none)"
fi
echo ""

echo "Xcode Settings → Accounts (required for CLI xcodebuild):"
if [ -n "$XCODE_TEAMS" ]; then
  while IFS= read -r team; do
    [ -n "$team" ] || continue
    marker=" "
    if [ "$team" = "$RESOLVED" ]; then marker="→"; fi
    echo "  $marker $team"
  done <<< "$XCODE_TEAMS"
else
  echo "  (none — sign in Apple ID in Xcode → Settings → Accounts)"
  fail=1
fi
echo ""

if grep -q 'DEVELOPMENT_TEAM = [A-Z0-9]' "$PBX" 2>/dev/null; then
  PBX_TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' "$PBX" | sed 's/.*= //;s/;//;s/ //g')
  echo "Project DEVELOPMENT_TEAM: $PBX_TEAM"
else
  echo "MISSING: No DEVELOPMENT_TEAM in project.pbxproj"
  fail=1
fi

if [ -n "$RESOLVED" ]; then
  echo "CLI will use team: $RESOLVED"
else
  echo "MISSING: Could not resolve DEVELOPMENT_TEAM"
  fail=1
fi

# Keychain cert without Xcode account = false positive (Ari's exact failure).
if [ -n "$RESOLVED" ] && [ -n "$KEYCHAIN_TEAMS" ] && echo "$KEYCHAIN_TEAMS" | grep -qx "$RESOLVED"; then
  if [ -z "$XCODE_TEAMS" ] || ! echo "$XCODE_TEAMS" | grep -qx "$RESOLVED"; then
    echo ""
    echo "ERROR: Team $RESOLVED has a keychain certificate but is NOT signed into Xcode."
    echo ""
    echo "  xcodebuild needs the Apple ID in Xcode → Settings → Accounts, not just a cert."
    echo ""
    echo "Fix:"
    echo "  1. Xcode → Settings → Accounts → +"
    echo "  2. Sign in with the Apple ID for team $RESOLVED (Ariel Layugan)"
    echo "  3. open ios/App/App.xcworkspace"
    echo "  4. App target → Signing & Capabilities → Team → Ariel Layugan"
    echo "  5. Product → Run (Cmd+R) — Xcode creates the provisioning profile"
    echo ""
    echo "If you use a different Apple ID, pick its Team in Signing & Capabilities, then:"
    echo "  RESTOREBRAINE_DEVELOPMENT_TEAM=YOUR_TEAM_ID bash scripts/mac-ios-v4-install.sh"
    fail=1
  fi
fi

if [ "$fail" = "0" ] && [ -n "$RESOLVED" ] && [ -n "$XCODE_TEAMS" ] && echo "$XCODE_TEAMS" | grep -qx "$RESOLVED"; then
  echo ""
  echo "OK: Team $RESOLVED is signed into Xcode."
  profile_count=0
  if [ -d "$HOME/Library/MobileDevice/Provisioning Profiles" ]; then
    for f in "$HOME/Library/MobileDevice/Provisioning Profiles"/*.mobileprovision; do
      [ -f "$f" ] || continue
      if security cms -D -i "$f" 2>/dev/null | grep -q "$BUNDLE_ID"; then
        profile_count=$((profile_count + 1))
      fi
    done
  fi
  if [ "$profile_count" = "0" ]; then
    echo "NOTE: No provisioning profile for $BUNDLE_ID yet — first Xcode Run will create it."
  else
    echo "OK: Found provisioning profile(s) for $BUNDLE_ID."
  fi
fi

echo ""
echo "Test deploy without device signing (Simulator):"
echo "  bash scripts/mac-xcode-build-simulator.sh"

exit "$fail"
