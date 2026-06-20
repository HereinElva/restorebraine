#!/usr/bin/env bash
# Discard auto-generated build files that often block git pull, then pull the iOS fix branch.
set -euo pipefail
BRANCH="${1:-cursor/fix-ios-hosted-white-screen-v85-bacf}"

cd "$(git rev-parse --show-toplevel)"

echo "Discarding local build stamp files (safe — npm run build regenerates them)..."
git checkout -- ios/App/App/BUILD_STAMP.txt src/lib/build-info.js src/lib/native-bundle-mode.js 2>/dev/null || true

echo "Pulling origin/$BRANCH ..."
git pull origin "$BRANCH"

echo ""
echo "Done. Pick ONE path:"
echo ""
echo "  A) Native app (bundled code, no Base44 URL bar) — recommended for testing:"
echo "     npm run build:native-local"
echo "     (do NOT run cap:hosted after)"
echo ""
echo "  B) Hosted mode (loads live Base44 — needs Publish in Base44 editor):"
echo "     npm run cap:hosted && npm run build"
echo ""
echo "Then Xcode: delete app → Clean Build Folder → Run"
echo "Open the Restorebraine icon from Xcode — NOT Safari."
