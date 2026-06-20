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
if bash scripts/mac-ios-v4-install.sh; then
  exit 0
fi

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//' || echo '?')

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BUILD OK: v${BUILD_NUM} · ${ENTRY} — install step did not run"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Bundle is ready in ios/App/App/public/. Put it on your iPhone:"
echo ""
echo "  Option A — CLI (iPhone connected USB or wireless-paired in Xcode):"
echo "    bash scripts/mac-ios-v4-install.sh"
echo ""
echo "  Option B — Xcode (works without USB if device is paired):"
echo "    1. open ios/App/App.xcworkspace"
echo "    2. Device menu → select YOUR iPhone (not My Mac)"
echo "    3. Delete Restorebraine from the iPhone"
echo "    4. Product → Clean Build Folder (Shift+Cmd+K)"
echo "    5. Product → Run (Cmd+R)"
echo "    6. Build log MUST show: Restorebraine DEPLOY OK"
echo ""
echo "On device login screen: deploy v${BUILD_NUM} · ${ENTRY} (not STALE BUNDLE)"
echo "Then: bash scripts/verify-xcode-app-bundle.sh"
exit 2
