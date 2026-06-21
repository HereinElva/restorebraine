#!/usr/bin/env bash
# Restorebraine 1.0.1 — ONE command: sync GitHub + rebuild + COMPLETE Xcode replace.
#
# Recreates Omega App Store 1.0.1 (3) architecture WITH all post-build-3 fixes:
#   • Back to Gallery (no sign-out)
#   • Sign out only via Sign Out button
#   • Stay logged in (native session persistence)
#   • Launch screen (logo + gradient)
#   • Folders tab: Organize, Custom, Duplicates, Select
#   • Login: Google, Apple, Microsoft, email
#
# Usage:
#   bash scripts/mac-build.sh              # bundled — full app on iPhone (default)
#   bash scripts/mac-build.sh --hosted     # Omega thin shell → Base44 live
#   bash scripts/mac-build.sh --omega      # same as default bundled 1.0.1
#   bash scripts/mac-build.sh --nuclear    # extra cache wipe (when device shows stale app)
#   bash scripts/mac-build.sh --no-git     # skip git sync (already synced)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
MODE=bundled
SKIP_GIT=0
NUCLEAR=0

for arg in "$@"; do
  case "$arg" in
    --hosted) MODE=hosted ;;
    --bundled|--omega) MODE=bundled ;;
    --nuclear) NUCLEAR=1 ;;
    --no-git) SKIP_GIT=1 ;;
    -h|--help)
      cat <<HELP
Restorebraine 1.0.1 — one-shot build

  bash scripts/mac-build.sh              bundled full app (recommended)
  bash scripts/mac-build.sh --hosted     Omega shell → restorebraine.base44.app
  bash scripts/mac-build.sh --nuclear    extra wipe when iPhone shows old app
  bash scripts/mac-build.sh --no-git     skip git fetch

Xcode after build: Clean → Run → Archive
Build log MUST show: FULL REPLACE + Restorebraine DEPLOY OK
HELP
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESTOREBRAINE 1.0.1 — complete Xcode app replace            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Mode: ${MODE} · Marketing version 1.0.1"
if [ "$MODE" = "bundled" ]; then
  echo "  Full app from GitHub — no Base44 paste required"
else
  echo "  Omega shell — loads live restorebraine.base44.app"
fi
echo ""

if [ "$SKIP_GIT" = "0" ]; then
  echo "=== Step 1: sync Mac ← GitHub ==="
  git fetch origin "$BRANCH"
  git fetch origin --tags 2>/dev/null || true
  git reset --hard "origin/$BRANCH"
  bash scripts/mac-ensure-development-team.sh 2>/dev/null || true
  echo "At: $(git log -1 --oneline)"
  echo ""
fi

echo "=== Step 1b: wipe stale ios bundle (survives git pull — causes v199 UI on device) ==="
rm -rf ios/App/App/public dist node_modules/.vite
mkdir -p ios/App/App/public/assets
echo "Removed old ios/App/App/public — fresh bundle will be built in Step 3"
echo ""

echo "=== Step 2: verify 1.0.1 features + Omega baseline ==="
node scripts/verify-restorebraine-1.0.1.mjs
node scripts/verify-omega-baseline.mjs
node scripts/verify-auth-flow.mjs
node scripts/verify-ios-bundle-version.mjs
echo ""

if [ "$NUCLEAR" = "1" ]; then
  echo "=== Nuclear wipe (extra caches) ==="
  if pgrep -x Xcode >/dev/null 2>&1; then
    osascript -e 'quit app "Xcode"' 2>/dev/null || killall Xcode 2>/dev/null || true
    sleep 2
  fi
  rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
  rm -rf ~/Library/Caches/com.apple.dt.Xcode 2>/dev/null || true
  echo ""
fi

echo "=== Step 3: wipe + rebuild entire ios/public (complete replace) ==="
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
  MODE_URL="bundled (capacitor://localhost)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  1.0.1 BUILD READY — Apple build ${BUILD_NUM} · deploy v${DEPLOY}"
echo "  ${FILE_COUNT} files · ${ENTRY}"
echo "  ${MODE_URL}"
echo "  ${STAMP}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "=== Step 4: Xcode — COMPLETE APP REPLACE ==="
echo ""
echo "  Delete Restorebraine from iPhone first (long-press → Remove App)"
echo ""
echo "  1. open ios/App/App.xcworkspace"
echo "  2. Product → Clean Build Folder  (Shift+Cmd+K)"
echo "  3. Product → Run on iPhone  (Cmd+R)"
echo "     Log MUST show:"
echo "       COMPLETE APP REPLACE"
echo "       FULL REPLACE: copied ${FILE_COUNT} files"
echo "       Restorebraine DEPLOY OK"
echo "  4. Product → Archive → Upload"
echo ""
echo "  Verify: bash scripts/verify-xcode-app-bundle.sh"
echo ""

open ios/App/App.xcworkspace 2>/dev/null || true
