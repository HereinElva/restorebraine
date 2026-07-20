#!/usr/bin/env bash
# One-time fix when git pull is blocked by local iOS/npm file changes.
# Safe: only resets tracked repo files to match the remote branch.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/apple-privacy-plist-bacf}"
echo "Fetching and hard-resetting to origin/$BRANCH ..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
# Never delete committed AppIcon PNGs under Assets.xcassets
git clean -fd --exclude=ios/App/App/Assets.xcassets/AppIcon.appiconset/
echo "Done. Now run: bash scripts/mac-fix-app-icon.sh"
