#!/usr/bin/env bash
# One-time fix when git pull is blocked by local iOS/npm file changes.
# Safe: only resets tracked repo files to match the remote branch.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/fix-native-xcode-coding-bacf}"
echo "Fetching and hard-resetting to origin/$BRANCH ..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
echo "Done. Now run: bash scripts/mac-ios-setup.sh"
