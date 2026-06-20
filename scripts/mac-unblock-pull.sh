#!/usr/bin/env bash
# Unblock git pull when cap-sync leaves modified/untracked files in ios/App/App/public/.
# Safe to run anytime — npm run build:native-local regenerates these files.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Force-clean iOS public bundle (unblock pull) ==="
rm -rf ios/App/App/public/assets
mkdir -p ios/App/App/public/assets
git checkout -f HEAD -- ios/App/App/public/ 2>/dev/null \
  || git restore --worktree ios/App/App/public/ 2>/dev/null \
  || true
git clean -ffdx ios/App/App/public/assets/ 2>/dev/null || true
bash scripts/mac-discard-build-files.sh 2>/dev/null || true

echo "Pulling origin/$BRANCH ..."
git pull origin "$BRANCH"

echo ""
echo "Pull OK. Next: bash scripts/mac-ios-native-rebuild.sh"
