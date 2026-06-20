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
echo "Done. Now run:"
echo "  npm run cap:hosted && npm run build"
echo "Then Xcode: delete app → Clean Build Folder → Run"
