#!/usr/bin/env bash
# v4-core full deploy: build bundle + install to connected iPhone.
#
# Default builds the CURRENT checkout (no git reset — avoids wiping local fixes).
# Pass --sync to pull origin branch first (git reset --hard).
#
# Terminal npm build alone NEVER updates the iPhone. This script runs install too.
set -euo pipefail
BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
SYNC=1
for arg in "$@"; do
  case "$arg" in
    --sync) SYNC=1 ;;
    --no-sync) SYNC=0 ;;
    --help|-h)
      echo "Usage: bash scripts/mac-ios-v4-deploy.sh [--no-sync]"
      echo "  default   pull origin/$BRANCH, merge web app into iOS, install to iPhone"
      echo "  --no-sync build current checkout only (skip git pull)"
      exit 0
      ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine v4 DEPLOY — build + install (not npm-only)    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Tip: Do not run 'git pull' manually — npm build changes index.html"
echo "     and build-info.js. This script resets those automatically."
echo ""

bash scripts/explain-deploy-targets.sh || true
echo ""

if [ "$SYNC" = "1" ]; then
  echo "=== Pull origin/$BRANCH + merge web app into iOS + install ==="
  bash scripts/mac-pull-and-rebuild.sh "$BRANCH"
else
  echo "=== Build current checkout (no git pull) + merge web → iOS ==="
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
echo "Most likely cause: Xcode signing (no Apple ID / team on this Mac)."
echo ""
echo "Fix signing (one time):"
echo "  1. Xcode → Settings → Accounts → + → sign in YOUR Apple ID"
echo "  2. bash scripts/mac-list-development-teams.sh   (lists team IDs)"
echo "  3. open ios/App/App.xcworkspace"
echo "     App target → Signing & Capabilities → Team → your Apple ID"
echo ""
echo "Then install — pick ONE:"
echo ""
echo "  Option A — CLI (auto-picks your signed-in team):"
echo "    bash scripts/mac-ios-v4-install.sh"
echo ""
echo "  Option B — Xcode Run (recommended if CLI still fails):"
echo "    1. Device menu → select YOUR iPhone (not My Mac)"
echo "    2. Delete Restorebraine from the iPhone"
echo "    3. Product → Clean Build Folder (Shift+Cmd+K)"
echo "    4. Product → Run (Cmd+R)"
echo "    5. Build log MUST show: Restorebraine DEPLOY OK"
echo ""
echo "On device login: v${BUILD_NUM} · ${ENTRY} · origin capacitor://localhost"
echo "Verify: bash scripts/verify-xcode-app-bundle.sh"
exit 2
