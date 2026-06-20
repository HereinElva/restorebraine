#!/usr/bin/env bash
# Open Xcode workspace and print exact signing steps for device install.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' ios/App/App.xcodeproj/project.pbxproj 2>/dev/null | sed 's/.*= //;s/;//;s/ //g' || echo "V378L53XQP")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — fix Xcode signing (device install)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Bundle is already built (v151). You only need signing + Run."
echo ""
echo "Project team: $TEAM"
echo ""

XCODE_TEAMS=$(bash scripts/mac-list-xcode-account-teams.sh --ids-only 2>/dev/null || true)
if [ -z "$XCODE_TEAMS" ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  STOP — no Apple ID in Xcode yet                             ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "CLI install will NOT work until you complete step 1 below."
  echo "Do NOT run RESTOREBRAINE_DEVELOPMENT_TEAM=YOUR_TEAM_ID (that is a placeholder)."
  echo ""
fi

bash scripts/mac-list-development-teams.sh 2>/dev/null || true
echo ""
bash scripts/mac-list-xcode-account-teams.sh 2>/dev/null || true
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "STEP 1 — REQUIRED (do this first, in Xcode):"
echo ""
echo "  Run: bash scripts/mac-open-xcode-accounts.sh"
echo "  (opens Xcode Settings — or manually: Xcode menu → Settings… → Accounts)"
echo ""
echo "  Click **Accounts** tab → **+** (bottom left) → **Apple ID** → sign in"
echo ""
echo "  Use Ariel Layugan's Apple ID for team $TEAM, OR your own Apple ID."
echo ""
echo "  After sign-in, run again to confirm:"
echo "    bash scripts/mac-list-xcode-account-teams.sh"
echo "  (must show at least one team — not NONE)"
echo ""
echo "STEP 2 — In the workspace (opening now):"
echo "  App target → Signing & Capabilities"
echo "  ✓ Automatically manage signing"
echo "  Team → pick the account you just signed in"
echo ""
echo "STEP 3 — Install to iPhone:"
echo "  Top bar → YOUR iPhone (not My Mac)"
echo "  Delete Restorebraine from iPhone"
echo "  Product → Clean Build Folder (Shift+Cmd+K)"
echo "  Product → Run (Cmd+R)"
echo ""
echo "Build log MUST contain: Restorebraine DEPLOY OK"
echo ""
echo "If project file was corrupted (YOUR_TEAM_ID):"
echo "  bash scripts/mac-reset-development-team.sh"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "Opening Xcode workspace..."
open ios/App/App.xcworkspace
