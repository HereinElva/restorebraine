#!/usr/bin/env bash
# One command: switch to native-local branch, discard build artifacts, pull latest, rebuild.
# Use when pull fails or you are accidentally on main.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "=== Restorebraine: pull latest and rebuild ==="
echo "Current branch: $CURRENT (target: $BRANCH)"

git fetch origin "$BRANCH"

if [ "$CURRENT" != "$BRANCH" ]; then
  echo "Switching from $CURRENT to $BRANCH ..."
fi

bash scripts/mac-discard-build-files.sh 2>/dev/null || true
git reset --hard "origin/$BRANCH"
bash scripts/mac-ensure-development-team.sh

echo ""
echo "Latest commit:"
git log --oneline -1
echo ""

bash scripts/mac-ios-native-rebuild.sh "$BRANCH"
