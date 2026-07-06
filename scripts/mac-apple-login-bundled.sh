#!/usr/bin/env bash
# One command: bundled App Store build with Apple login fix in ios/public (no Base44).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Apple login fix — BUNDLED build (recommended for App Store) ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This ships login UI from your Mac (Sign in with Apple + logo)."
echo "Does NOT load old Base44 v162 website for login."
echo ""

bash scripts/mac-build.sh --bundled "$@"

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
node scripts/verify-bundled-deploy-ready.mjs

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  XCODE — install on iPhone"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Delete Restorebraine from iPhone"
echo "  2. open ios/App/App.xcworkspace"
echo "  3. Clean Build Folder (Shift+Cmd+K)"
echo "  4. Run on YOUR iPhone (Cmd+R) — NOT TestFlight old build"
echo ""
echo "  Login MUST show:"
echo "    • purple \"Login v${BUILD}\" banner"
echo "    • Sign in with Apple + white logo"
echo ""
echo "  If you still see \"Continue With Apple\" → Xcode did not install this build."
echo ""
