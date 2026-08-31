#!/usr/bin/env bash
# List Apple Development team IDs available in this Mac's keychain (signed-in Xcode accounts).
set -euo pipefail

list_teams() {
  security find-identity -v -p codesigning 2>/dev/null \
    | grep -E 'Apple Development|Apple Distribution' \
    | sed -n 's/.*(\([A-Z0-9]\{10\}\)).*/\1/p' \
    | sort -u
}

if [ "${1:-}" = "--ids-only" ]; then
  list_teams
  exit 0
fi

echo "=== Available signing teams on this Mac ==="
echo "(Keychain certificates — may exist without Apple ID in Xcode Accounts)"
echo ""
teams=$(list_teams || true)
if [ -z "$teams" ]; then
  echo "NONE — no Apple Development certificate in keychain."
  echo ""
  echo "Fix:"
  echo "  1. Xcode → Settings → Accounts → + → sign in with your Apple ID"
  echo "  2. Select your Apple ID → Manage Certificates → + → Apple Development"
  echo "  3. Re-run: bash scripts/mac-list-development-teams.sh"
  exit 1
fi

while IFS= read -r team; do
  [ -n "$team" ] || continue
  label=$(security find-identity -v -p codesigning 2>/dev/null \
    | grep "($team)" | head -1 | sed 's/^[[:space:]]*[0-9]*) //;s/"$//' || true)
  echo "  $team  ${label:-(Apple Development)}"
done <<< "$teams"

echo ""
echo "Use a specific team for CLI install (replace with real 10-char ID from list above):"
echo "  RESTOREBRAINE_DEVELOPMENT_TEAM=V378L53XQP bash scripts/mac-ios-v4-install.sh"
echo ""
echo "Do NOT copy YOUR_TEAM_ID literally — that is documentation placeholder text."
