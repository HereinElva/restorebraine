#!/usr/bin/env bash
# Unblock git pull when local files block merge, then sync to latest branch.
#
# Usage:
#   bash scripts/mac-unblock-pull.sh
#   bash scripts/mac-unblock-pull.sh && bash scripts/mac-build.sh
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Unblock pull → origin/$BRANCH ==="
echo ""

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets

bash scripts/mac-ensure-development-team.sh 2>/dev/null || true

echo ""
echo "Synced to: $(git log -1 --oneline)"
echo ""
echo "Next:"
echo "  bash scripts/mac-build.sh"
echo ""
