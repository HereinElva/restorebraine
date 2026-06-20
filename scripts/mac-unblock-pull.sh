#!/usr/bin/env bash
# Unblock git pull when on wrong branch or build artifacts block merge.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "=== Force-clean and sync to origin/$BRANCH ==="
echo "Current branch: $CURRENT"

git fetch origin "$BRANCH"
bash scripts/mac-discard-build-files.sh 2>/dev/null || true
git checkout -f HEAD -- ios/App/App.xcodeproj/project.pbxproj 2>/dev/null || true

git checkout -B "$BRANCH" "origin/$BRANCH"

echo ""
echo "Synced to:"
git log --oneline -1
echo ""
echo "Next: bash scripts/mac-ios-native-rebuild.sh"
