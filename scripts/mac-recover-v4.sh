#!/usr/bin/env bash
# Recover from wrong branch / missing scripts.
#
# Usage: bash scripts/mac-recover-v4.sh
set -euo pipefail

BRANCH="cursor/fix-folder-persistence-bacf"
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Restorebraine recovery → $BRANCH ==="
echo ""
echo "NOTE: App Store builds use HOSTED mode (Base44 live UI)."
echo "      After sync: bash scripts/mac-build.sh --hosted --no-git"
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

if [ ! -f scripts/mac-build.sh ]; then
  echo "ERROR: still missing mac-build.sh — check network / repo URL"
  exit 1
fi

echo "Next:"
echo "  node scripts/audit-base44-bundle.mjs"
echo "  bash scripts/mac-build.sh --hosted --no-git"
echo "  bash scripts/mac-diagnose-mobile.sh"
