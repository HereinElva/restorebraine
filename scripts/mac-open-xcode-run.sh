#!/usr/bin/env bash
# Open Xcode and show repo vs DerivedData bundle status before Run.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo '?')
REPO_STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — Xcode Run (install v${BUILD_NUM} to iPhone)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Repo ready:  ${REPO_STAMP}"
echo "Entry JS:    ${ENTRY}"
echo ""

if bash scripts/verify-xcode-app-bundle.sh 2>/dev/null; then
  echo ""
  echo "DerivedData already matches repo — Run in Xcode to push to iPhone if needed."
else
  echo ""
  echo "DerivedData is STALE (see FAIL above) — terminal build did not update App.app."
  echo "Only Xcode Run copies ios/App/App/public/ into the installed .app."
fi

echo ""
echo "In Xcode:"
echo "  1. Device menu → your iPhone (not My Mac)"
echo "  2. Delete Restorebraine from the iPhone"
echo "  3. Product → Clean Build Folder (Shift+Cmd+K)"
echo "  4. Product → Run (Cmd+R)"
echo "  5. Build log MUST show: Restorebraine DEPLOY OK"
echo ""
echo "After Run: bash scripts/verify-xcode-app-bundle.sh"
echo ""

open ios/App/App.xcworkspace
