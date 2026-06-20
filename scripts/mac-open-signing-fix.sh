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
bash scripts/mac-list-development-teams.sh 2>/dev/null || true
echo ""
bash scripts/mac-list-xcode-account-teams.sh 2>/dev/null || true
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "DO THIS IN XCODE (required once):"
echo ""
echo "  1. Xcode → Settings → Accounts → + → sign in Apple ID"
echo "     (Use the Apple ID that owns team $TEAM, or pick YOUR team below)"
echo ""
echo "  2. In the workspace about to open:"
echo "     App target → Signing & Capabilities"
echo "     ✓ Automatically manage signing"
echo "     Team → select your Apple ID / team"
echo ""
echo "  3. Top bar → select YOUR iPhone (not My Mac)"
echo "  4. Delete Restorebraine from the iPhone"
echo "  5. Product → Clean Build Folder (Shift+Cmd+K)"
echo "  6. Product → Run (Cmd+R)"
echo ""
echo "Build log MUST contain: Restorebraine DEPLOY OK"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "Opening Xcode workspace..."
open ios/App/App.xcworkspace
