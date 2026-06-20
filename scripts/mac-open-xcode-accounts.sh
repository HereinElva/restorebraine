#!/usr/bin/env bash
# Open Xcode Settings so you can sign in Apple ID (Accounts tab).
set -euo pipefail

echo "Opening Xcode → Settings…"
echo ""
echo "In the window that opens:"
echo "  1. Click the **Accounts** tab (top of window)"
echo "  2. Click **+** (bottom-left corner)"
echo "  3. Choose **Apple ID**"
echo "  4. Sign in with your Apple ID (or Ariel Layugan's for team V378L53XQP)"
echo ""
echo "When done, verify in Terminal:"
echo "  bash scripts/mac-list-xcode-account-teams.sh"
echo "  (must NOT say NONE)"
echo ""

if ! open -a Xcode 2>/dev/null; then
  echo "ERROR: Xcode not found. Install from App Store first."
  exit 1
fi

sleep 2
osascript <<'APPLESCRIPT' || true
tell application "Xcode" to activate
delay 0.5
tell application "System Events"
  tell process "Xcode"
    -- Xcode → Settings… (Cmd+,)
    keystroke "," using command down
  end tell
end tell
APPLESCRIPT

echo "If Settings did not open: click Xcode menu bar → Settings… (or press Cmd+,)"
echo "Then Accounts tab → + → Apple ID"
