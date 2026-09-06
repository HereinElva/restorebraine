#!/usr/bin/env bash
# One command: bundled App Store build with Apple login fix in ios/public (no Base44).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Apple login fix — BUNDLED build (dev / experiments only)    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠ App Store / TestFlight should use HOSTED mode instead:"
echo "    bash scripts/mac-build.sh --hosted"
echo ""
echo "Bundled ships login UI from ios/public — ignores Base44 folder/stripe fixes."
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
echo "    • Sign in with Apple + white logo"
echo "    • No \"Login v${BUILD}\" or \"Build v${BUILD}\" banners"
echo ""
echo "  If you still see \"Continue With Apple\" → Xcode did not install this build."
echo ""
