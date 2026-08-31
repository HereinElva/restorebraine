#!/usr/bin/env bash
# Open Xcode — you sign in manually (no Terminal permissions needed).
set -euo pipefail

echo "════════════════════════════════════════════════════════════════"
echo "  Sign into Xcode — do this manually (ignore Terminal popups)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "STEP 1 — Open Xcode app"
echo "  Click the blue Xcode icon in your Dock"
echo ""
echo "STEP 2 — Open Settings"
echo "  Top of screen: menu bar → **Xcode** → **Settings…**"
echo "  (Keyboard shortcut: Cmd+,)"
echo ""
echo "STEP 3 — Accounts tab"
echo "  Click **Accounts** at the top of the Settings window"
echo ""
echo "STEP 4 — Add Apple ID"
echo "  Click **+** button (bottom-left corner of the window)"
echo "  Choose **Apple ID**"
echo "  Enter email + password (your Apple ID, or Ariel's for team V378L53XQP)"
echo "  Complete 2-factor if prompted"
echo ""
echo "STEP 5 — Verify in Terminal"
echo "  bash scripts/mac-list-xcode-account-teams.sh"
echo "  Must show a team like V378L53XQP — NOT 'NONE'"
echo ""
echo "STEP 6 — Run to iPhone"
echo "  open ios/App/App.xcworkspace"
echo "  App target → Signing & Capabilities → Team → your account"
echo "  Select iPhone → Product → Run (Cmd+R)"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

open -a Xcode 2>/dev/null || {
  echo "ERROR: Xcode not installed. Get it from the Mac App Store."
  exit 1
}

echo "Xcode is opening. Use the menu bar: Xcode → Settings… → Accounts → + → Apple ID"
