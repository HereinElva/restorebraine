#!/usr/bin/env bash
# ONE COMMAND — full iOS rebuild + replace entire Xcode bundle. No Base44 paste.
#
# Omega App Store build 1.0.1 (3) used --hosted (thin shell → live website).
# Default --bundled ships the FULL app from git (v178 login, gallery, etc.) — works
# even when Base44 live site is stuck on v162. No paste, no wizard, no Safari checks.
#
# Usage:
#   bash scripts/mac-build.sh              # bundled — recommended (self-contained)
#   bash scripts/mac-build.sh --hosted     # Omega thin shell (login = live Base44)
#   bash scripts/mac-build.sh --no-git     # skip git pull
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
MODE=bundled
SKIP_GIT=0

for arg in "$@"; do
  case "$arg" in
    --hosted) MODE=hosted ;;
    --bundled) MODE=bundled ;;
    --no-git) SKIP_GIT=1 ;;
    -h|--help)
      cat <<HELP
Usage: bash scripts/mac-build.sh [--bundled|--hosted] [--no-git]

  --bundled   DEFAULT. Full v178 app inside the iPhone build. No Base44 needed.
  --hosted    Omega / App Store 1.0.1 (3) — loads restorebraine.base44.app
  --no-git    Skip git pull

Then in Xcode: Clean Build Folder → Run → Archive
HELP
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESTOREBRAINE — one-shot full Xcode replace                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Mode: ${MODE}"
if [ "$MODE" = "bundled" ]; then
  echo "  Full app from git — login + gallery built in. No Base44 paste."
else
  echo "  Omega thin shell — app loads live restorebraine.base44.app"
fi
echo ""

if [ "$SKIP_GIT" = "0" ]; then
  echo "=== Step 1: sync git ==="
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  bash scripts/mac-ensure-development-team.sh 2>/dev/null || true
  echo "At: $(git log -1 --oneline)"
  echo ""
fi

echo "=== Step 2: verify Omega gallery + auth ==="
node scripts/verify-omega-baseline.mjs
node scripts/verify-auth-flow.mjs
echo ""

echo "=== Step 3: wipe + full rebuild + replace entire ios/public ==="
if [ "$MODE" = "hosted" ]; then
  bash scripts/mac-xcode-full-replace.sh --hosted
else
  bash scripts/mac-xcode-full-replace.sh --bundled
fi

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
FILE_COUNT=$(find ios/App/App/public -type f | wc -l | tr -d ' ')
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo unknown)

if [ "$MODE" = "hosted" ]; then
  MODE_URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json | head -1 || echo "no server.url")
else
  MODE_URL="capacitor://localhost (bundled)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BUILD READY — v${BUILD_NUM} · deploy v${DEPLOY}"
echo "  ${FILE_COUNT} files · ${ENTRY}"
echo "  ${MODE_URL}"
echo "  BUILD_STAMP: ${STAMP}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "=== Step 4: open Xcode ==="
echo ""
echo "  In Xcode do these 3 things ONLY:"
echo ""
echo "    1. Product → Clean Build Folder  (Shift+Cmd+K)"
echo "    2. Product → Run on your iPhone  (Cmd+R)"
echo "       Build log MUST show:"
echo "         FULL REPLACE: copied ${FILE_COUNT} files into App.app/public"
echo "         Restorebraine DEPLOY OK"
echo "    3. Product → Archive → Upload"
echo ""
echo "  Verify after Run:"
if [ "$MODE" = "hosted" ]; then
  echo "    bash scripts/verify-hosted-app-bundle.sh"
else
  echo "    bash scripts/verify-xcode-app-bundle.sh"
fi
echo ""

open ios/App/App.xcworkspace 2>/dev/null || echo "  open ios/App/App.xcworkspace"
