#!/usr/bin/env bash
# Team IDs registered in Xcode → Settings → Accounts (NOT keychain certs alone).
set -euo pipefail

list_xcode_account_teams() {
  local found=""
  local dir file

  # Primary: IDEAccounts.plist (all Xcode versions)
  for file in \
    "$HOME/Library/Developer/Xcode/UserData/IDEAccounts.plist" \
    "$HOME/Library/Developer/Xcode/UserData/IDEAccounts 2.plist"; do
    if [ -f "$file" ]; then
      found+=$(plutil -p "$file" 2>/dev/null \
        | grep -E '"teamID"' \
        | sed -E 's/.*"teamID" => "([^"]+)".*/\1/' \
        | sort -u)
      found+=$'\n'
    fi
  done

  # Scan other UserData plists (some Xcode versions store teams elsewhere)
  if [ -d "$HOME/Library/Developer/Xcode/UserData" ]; then
    while IFS= read -r file; do
      [ -f "$file" ] || continue
      found+=$(plutil -p "$file" 2>/dev/null \
        | grep -E '"teamID"' \
        | sed -E 's/.*"teamID" => "([^"]+)".*/\1/' \
        | sort -u)
      found+=$'\n'
    done < <(find "$HOME/Library/Developer/Xcode/UserData" -maxdepth 2 -name '*.plist' 2>/dev/null)
  fi

  echo "$found" | grep -E '^[A-Z0-9]{10}$' | sort -u
}

if [ "${1:-}" = "--ids-only" ]; then
  list_xcode_account_teams
  exit 0
fi

echo "=== Xcode Settings → Accounts teams ==="
echo ""
teams=$(list_xcode_account_teams || true)
if [ -z "$teams" ]; then
  echo "NONE — no Apple ID signed into Xcode on this Mac."
  echo ""
  echo "The osascript / Terminal permission error is harmless — sign in manually:"
  echo ""
  echo "  1. Click the Xcode icon in the Dock (blue hammer)"
  echo "  2. Top menu bar → click **Xcode** (next to  Apple logo)"
  echo "  3. **Settings…** (or press Cmd+,)"
  echo "  4. **Accounts** tab → **+** (bottom left) → **Apple ID** → sign in"
  echo ""
  echo "Do NOT use Terminal install until this command shows a team:"
  echo "  bash scripts/mac-list-xcode-account-teams.sh"
  echo ""
  echo "Then in workspace: App → Signing & Capabilities → Team → Product → Run"
  exit 1
fi

while IFS= read -r team; do
  [ -n "$team" ] || continue
  echo "  $team"
done <<< "$teams"
