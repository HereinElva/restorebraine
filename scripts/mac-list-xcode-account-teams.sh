#!/usr/bin/env bash
# Team IDs registered in Xcode → Settings → Accounts (NOT the same as keychain certs alone).
set -euo pipefail

list_xcode_account_teams() {
  local accounts_file="$HOME/Library/Developer/Xcode/UserData/IDEAccounts.plist"
  if [ ! -f "$accounts_file" ]; then
    return 0
  fi
  plutil -p "$accounts_file" 2>/dev/null \
    | grep -E '"teamID"' \
    | sed -E 's/.*"teamID" => "([^"]+)".*/\1/' \
    | sort -u
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
  echo "This is why xcodebuild fails with 'No Account for Team' even when a"
  echo "certificate appears in the keychain."
  echo ""
  echo "Fix:"
  echo "  1. Xcode → Settings → Accounts → + → sign in Apple ID"
  echo "  2. Select the account → Download Manual Profiles (if shown)"
  echo "  3. open ios/App/App.xcworkspace → App → Signing & Capabilities → Team"
  exit 1
fi

while IFS= read -r team; do
  [ -n "$team" ] || continue
  echo "  $team"
done <<< "$teams"
