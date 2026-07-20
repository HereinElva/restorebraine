#!/usr/bin/env bash
# Force-sync Mac repo to origin branch (discards local stamp/build debris).
# Fixes "git pull blocked by project.pbxproj" from Xcode opening the project.
#
# Usage: bash scripts/sync-branch.sh
#        npm run sync:branch
#        npm run sync:force
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-cursor/apple-privacy-plist-bacf}"

echo "==> Fetch origin/$BRANCH"
git fetch origin "$BRANCH"

echo "==> Reset hard to origin/$BRANCH"
echo "    (drops local Xcode project.pbxproj drift + BUILD_STAMP changes)"
git reset --hard "origin/$BRANCH"

echo "==> Clean generated debris"
git clean -fd -- dist ios/App/build node_modules/.vite 2>/dev/null || true

echo
echo "✓ Synced to $(git rev-parse --short HEAD) on $BRANCH"
echo "  Next: npm run ghosts:scan"
echo "  Or:   npm run revert:terminal"
