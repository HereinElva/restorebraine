#!/usr/bin/env bash
# v4-core full deploy: build bundle + install to connected iPhone.
#
# Default builds the CURRENT checkout (no git reset — avoids wiping local fixes).
# Pass --sync to pull origin branch first (git reset --hard).
#
# Terminal npm build alone NEVER updates the iPhone. This script runs install too.
set -euo pipefail
BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
SYNC=0
for arg in "$@"; do
  case "$arg" in
    --sync) SYNC=1 ;;
    --help|-h)
      echo "Usage: bash scripts/mac-ios-v4-deploy.sh [--sync]"
      echo "  default   build current tree + install to connected iPhone"
      echo "  --sync    git fetch + reset --hard origin/$BRANCH, then build + install"
      exit 0
      ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine v4 DEPLOY — build + install (not npm-only)    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ "$SYNC" = "1" ]; then
  echo "=== --sync: pull origin/$BRANCH then build ==="
  bash scripts/mac-pull-and-rebuild.sh "$BRANCH"
else
  echo "=== Build from current checkout (no git reset) ==="
  echo "  Tip: pass --sync to pull latest from origin/$BRANCH first"
  bash scripts/mac-ios-v4-build.sh
fi

echo ""
bash scripts/mac-ios-v4-install.sh
