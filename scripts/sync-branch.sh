#!/usr/bin/env bash
# Force-sync Mac repo to origin branch (discards local stamp/build debris).
# Usage: bash scripts/sync-branch.sh
#        npm run sync:branch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-cursor/apple-privacy-plist-bacf}"

echo "==> Fetch origin/$BRANCH"
git fetch origin "$BRANCH"

echo "==> Reset hard to origin/$BRANCH (drops BUILD_STAMP / build-info local drift)"
git reset --hard "origin/$BRANCH"

echo "==> Clean generated debris"
git clean -fd -- dist ios/App/build node_modules/.vite 2>/dev/null || true

echo
echo "✓ Synced to $(git rev-parse --short HEAD) on $BRANCH"
echo "  Next: npm run align:all -- --skip-capacitor"
echo "  If Base44 stale: npm run align:watch (after browser Publish)"
