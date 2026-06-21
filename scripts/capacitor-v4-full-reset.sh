#!/usr/bin/env bash
# Full Capacitor v4 reset — wipes stale layers and rebuilds build-v4 native shell only.
# Use when device shows old OAuth behavior or "no change" after normal deploy.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=========================================="
echo "  Restorebraine Capacitor v4 FULL RESET"
echo "=========================================="
echo ""

# 1. Sync branch
CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
if [ "$CURRENT" != "$BRANCH" ]; then
  echo "Switching to $BRANCH ..."
  git fetch origin "$BRANCH"
  git checkout -f -B "$BRANCH" "origin/$BRANCH"
fi

# 2. Remove stale Capacitor artifacts (old OAuth layers, orphan bundles)
echo "Removing stale Capacitor build artifacts ..."
rm -rf dist node_modules/.vite ios/App/App/public
rm -f ios/App/App/public/capacitor-v4-session-bridge.js 2>/dev/null || true
mkdir -p ios/App/App/public/assets

# 3. Verify v4 bridge is present (build v4 requirement)
if [ ! -f public/restorebraine-v4-bridge.js ]; then
  echo "error: public/restorebraine-v4-bridge.js missing — build v4 bridge not in repo"
  exit 1
fi
echo "OK: restorebraine-v4-bridge.js present ($(wc -c < public/restorebraine-v4-bridge.js) bytes)"

# 4. Nuclear scrub (Xcode caches, pods, full rebuild)
bash scripts/mac-nuclear-scrub.sh "$BRANCH"

# 5. Post-build audit
CAPACITOR_LOCAL=1 node scripts/capacitor-audit.mjs

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
BRIDGE=$(test -f ios/App/App/public/restorebraine-v4-bridge.js && echo yes || echo no)

echo ""
echo "=========================================="
echo "  v4 FULL RESET COMPLETE — v${BUILD_NUM}"
echo "  v4-bridge in ios/public: ${BRIDGE}"
echo "=========================================="
echo ""
echo "On device badge must show:"
echo "  v${BUILD_NUM} · v4-core"
echo "  origin: capacitor://localhost"
echo "  OAuth mode after tap: v4-bridge"
echo ""
echo "Delete app from iPhone → Xcode Clean → Run"
