#!/usr/bin/env bash
# Unblock git pull when build stamps (index.html, build-info.js, etc.) block merge.
# Usage: bash scripts/mac-unblock-pull.sh
#        bash scripts/mac-unblock-pull.sh && bash scripts/mac-ios-v4-deploy.sh --no-sync
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "=== Unblock pull — reset build stamps, sync to origin/$BRANCH ==="
echo "Current branch: $CURRENT"
echo ""
echo "If git pull failed with 'local changes would be overwritten', this fixes it."
echo "Do NOT run 'git pull' before deploy — use mac-ios-v4-deploy.sh instead."
echo ""

git fetch origin "$BRANCH"
bash scripts/mac-discard-build-files.sh

git checkout -B "$BRANCH" "origin/$BRANCH"
bash scripts/mac-ensure-development-team.sh

echo ""
echo "Synced to:"
git log --oneline -1
echo ""
echo "Next (build + install to iPhone):"
echo "  bash scripts/mac-ios-v4-deploy.sh --no-sync"
