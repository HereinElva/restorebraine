#!/usr/bin/env bash
# Rebuild iOS with native Apple login fix (works on hosted Base44 v162 — no Base44 publish).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Apple login — native inject rebuild (no Base44 publish)     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This adds Apple logo + \"Sign in with Apple\" via iOS native code"
echo "even when the app loads old hosted Base44 (Continue With Apple)."
echo ""

bash scripts/mac-build.sh --hosted "$@"

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  NEXT — Xcode ONLY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Delete Restorebraine from iPhone"
echo "  2. Xcode → Clean Build Folder (Shift+Cmd+K)"
echo "  3. Product → Run on YOUR iPhone (Cmd+R)"
echo ""
echo "  Apple button should show white logo + \"Sign in with Apple\""
echo "  (Hosted Base44 text may flash briefly — native inject fixes it)"
echo ""
echo "  Official Apple Sign in with Apple button (native overlay)"
echo "  Build v${BUILD} · must compile RestorebraineAppleLoginOverlay.swift"
echo ""
