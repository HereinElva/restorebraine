#!/usr/bin/env bash
# Recover from wrong branch / missing scripts — always syncs v4-core work branch.
# Safe to run even if mac-force-sync.sh reset you to cursor/fix-native-xcode-coding-bacf (v60).
#
# Usage: bash scripts/mac-recover-v4.sh
#    or: curl -sL ...  (see README) — prefer git fetch below if scripts are missing.
set -euo pipefail

BRANCH="cursor/fix-native-localhost-oauth-bacf"
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Restorebraine v4-core recovery ==="
echo "Target branch: $BRANCH (NOT fix-native-xcode-coding-bacf)"
echo ""

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "Current branch: $CURRENT"

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

echo ""
echo "Now at:"
git log --oneline -1
echo ""

if [ ! -f scripts/mac-ios-v4-rebuild.sh ]; then
  echo "ERROR: still missing mac-ios-v4-rebuild.sh — wrong branch?"
  exit 1
fi

echo "Rebuilding v4-core bundle..."
bash scripts/mac-ios-v4-rebuild.sh

echo ""
echo "=== Next in Xcode ==="
echo "  1. Delete Restorebraine from iPhone"
echo "  2. Clean Build Folder (Shift+Cmd+K)"
echo "  3. Run (Cmd+R) to iPhone — build log must show: Restorebraine DEPLOY OK"
echo "  4. bash scripts/verify-xcode-app-bundle.sh"
