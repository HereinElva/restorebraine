#!/usr/bin/env bash
# Resolve DEVELOPMENT_TEAM for CLI xcodebuild — prefers a team this Mac can actually sign with.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

source "$(dirname "$0")/mac-validate-team-id.sh"

PBX="ios/App/App.xcodeproj/project.pbxproj"
DEFAULT_TEAM="V378L53XQP"

list_available_teams() {
  security find-identity -v -p codesigning 2>/dev/null \
    | grep -E 'Apple Development|Apple Distribution' \
    | sed -n 's/.*(\([A-Z0-9]\{10\}\)).*/\1/p' \
    | sort -u
}

team_is_available() {
  local team="$1"
  list_available_teams | grep -qx "$team"
}

read_pbx_team() {
  if [ -f "$PBX" ]; then
    grep 'DEVELOPMENT_TEAM = ' "$PBX" | head -1 | sed 's/.*= //;s/;//;s/ //g' || true
  fi
}

if [ -n "${RESTOREBRAINE_DEVELOPMENT_TEAM:-}" ]; then
  if ! validate_team_id "$RESTOREBRAINE_DEVELOPMENT_TEAM"; then
    echo "ERROR: RESTOREBRAINE_DEVELOPMENT_TEAM='$RESTOREBRAINE_DEVELOPMENT_TEAM' is not valid." >&2
    echo "  Do NOT paste the placeholder YOUR_TEAM_ID — use your real 10-character team ID." >&2
    echo "  After signing into Xcode: bash scripts/mac-list-xcode-account-teams.sh" >&2
    echo "  Reset bad project file: bash scripts/mac-reset-development-team.sh" >&2
    exit 1
  fi
  echo "$RESTOREBRAINE_DEVELOPMENT_TEAM"
  exit 0
fi

PBX_TEAM=$(read_pbx_team)
if [ -n "$PBX_TEAM" ] && ! validate_team_id "$PBX_TEAM"; then
  echo "WARNING: project.pbxproj has invalid DEVELOPMENT_TEAM='$PBX_TEAM' — using $DEFAULT_TEAM." >&2
  echo "  Run: bash scripts/mac-reset-development-team.sh" >&2
  PBX_TEAM="$DEFAULT_TEAM"
fi

AVAILABLE=$(list_available_teams || true)
FIRST_AVAILABLE=$(echo "$AVAILABLE" | head -1)

# Project team is usable on this Mac — keep it.
if [ -n "$PBX_TEAM" ] && team_is_available "$PBX_TEAM"; then
  echo "$PBX_TEAM"
  exit 0
fi

# Project team missing from keychain — use first signed-in team instead of failing.
if [ -n "$FIRST_AVAILABLE" ]; then
  if [ -n "$PBX_TEAM" ] && [ "$PBX_TEAM" != "$FIRST_AVAILABLE" ]; then
    echo "NOTE: Team $PBX_TEAM not in keychain — using $FIRST_AVAILABLE instead." >&2
    echo "  (Set RESTOREBRAINE_DEVELOPMENT_TEAM to override)" >&2
  fi
  echo "$FIRST_AVAILABLE"
  exit 0
fi

# No keychain certs — fall back to project/default (xcodebuild will fail with clear error).
if [ -n "$PBX_TEAM" ]; then
  echo "$PBX_TEAM"
  exit 0
fi

echo "$DEFAULT_TEAM"
