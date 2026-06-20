#!/usr/bin/env bash
# Resolve DEVELOPMENT_TEAM for CLI xcodebuild — prefers a team this Mac can actually sign with.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

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
  echo "$RESTOREBRAINE_DEVELOPMENT_TEAM"
  exit 0
fi

PBX_TEAM=$(read_pbx_team)
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
    echo "NOTE: Team $PBX_TEAM not in Xcode on this Mac — using $FIRST_AVAILABLE instead." >&2
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
