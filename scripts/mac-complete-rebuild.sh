#!/usr/bin/env bash
# Complete hosted rebuild — GitHub → Capacitor shell → ready for Xcode Run.
# Wipes ghost/stale bundles, syncs to origin branch, rebuilds hosted (Base44 live UI).
#
# Usage:
#   bash scripts/mac-complete-rebuild.sh
#   bash scripts/mac-complete-rebuild.sh --skip-audit   # faster, skip verify scripts
#
# After this script: Xcode Product → Run only (do not rebuild in Terminal).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-folder-persistence-bacf}"
SKIP_AUDIT=0
for arg in "$@"; do
  case "$arg" in
    --skip-audit) SKIP_AUDIT=1 ;;
    -h|--help)
      cat <<HELP
Complete hosted rebuild (no ghost builds)

  bash scripts/mac-complete-rebuild.sh

What it does:
  1. Sync Mac ← GitHub (origin/$BRANCH, discard stale build-info)
  2. Wipe dist, vite cache, ios/public, BUNDLED_MODE, Xcode DerivedData
  3. Hosted rebuild (sync-build-numbers + build:web — does NOT auto-bump version)
  4. Audit repo + Base44 live (unless --skip-audit)

Then in Xcode: Delete app → Clean → Run → Restorebraine DEPLOY OK

Base44 UI fixes still require: bash scripts/base44-publish-wizard.sh → Publish
HELP
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  COMPLETE HOSTED REBUILD — GitHub · Capacitor · no ghosts    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. GitHub sync ──────────────────────────────────────────────────────────
echo "=== 1/4: Sync GitHub → Mac ==="
bash scripts/mac-sync-github.sh
echo ""

COMMIT=$(git rev-parse --short HEAD)
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')

if [ "$BUILD" != "$DEPLOY" ]; then
  echo "FAIL: BUILD_NUMBER ($BUILD) ≠ DEPLOY_BUILD ($DEPLOY) after sync"
  echo "  Run: node scripts/sync-build-numbers.mjs"
  exit 1
fi

echo "OK: $COMMIT · deploy v$DEPLOY"
echo ""

# ── 2. Ghost / stale wipe (beyond sync) ───────────────────────────────────────
echo "=== 2/4: Wipe ghost + stale artifacts ==="
rm -rf dist node_modules/.vite ios/App/App/public
rm -f ios/App/App/BUNDLED_MODE.txt
mkdir -p ios/App/App/public/assets

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "Quitting Xcode (DerivedData wipe)..."
  osascript -e 'quit app "Xcode"' 2>/dev/null || killall Xcode 2>/dev/null || true
  sleep 2
fi

find ~/Library/Developer/Xcode/DerivedData -maxdepth 1 -type d -name 'App-*' 2>/dev/null | while read -r dir; do
  echo "  removing $dir"
  rm -rf "$dir"
done

echo "OK: dist, ios/public, BUNDLED_MODE, DerivedData wiped"
echo ""

# ── 3. Hosted rebuild (no git, no version bump) ─────────────────────────────
echo "=== 3/4: Hosted Capacitor shell rebuild ==="
bash scripts/mac-build.sh --hosted --no-git
echo ""

# ── 4. Verify ───────────────────────────────────────────────────────────────
echo "=== 4/4: Verify harmonization ==="
URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json | head -1 || true)
STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//' || echo missing)

echo "  commit:     $COMMIT"
echo "  deploy:     v$DEPLOY"
echo "  BUILD_STAMP: $STAMP"
echo "  entry:      $ENTRY"
echo "  server.url: ${URL:-missing}"
echo ""

if echo "$URL" | grep -q 'restorebraine.base44.app'; then
  echo "OK: hosted mode"
else
  echo "FAIL: not hosted — server.url missing Base44"
  exit 1
fi

if [ -f ios/App/App/BUNDLED_MODE.txt ]; then
  echo "FAIL: BUNDLED_MODE.txt present — would ignore Base44 Publish"
  exit 1
fi

if [ "$SKIP_AUDIT" = "0" ]; then
  node scripts/verify-build-sync.mjs
  node scripts/audit-base44-bundle.mjs || true
  node scripts/verify-full-stack-sync.mjs || true
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  TERMINAL DONE — v$DEPLOY hosted shell ready for Xcode"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Xcode (required — installs app on iPhone):"
echo "  1. Delete Restorebraine from iPhone"
echo "  2. open ios/App/App.xcworkspace"
echo "  3. Select your iPhone (not Simulator)"
echo "  4. Product → Clean Build Folder"
echo "  5. Product → Run (Cmd+R)"
echo "  6. Build log MUST show: Restorebraine DEPLOY OK"
echo ""
echo "Verify after Run:"
echo "  bash scripts/verify-xcode-app-bundle.sh"
echo "  bash scripts/verify-hosted-app-bundle.sh"
echo ""
echo "Web UI fixes (folders, Stripe guard, runtime overlay) also need Base44 Publish:"
echo "  bash scripts/base44-publish-wizard.sh"
echo "  → Publish once in Base44 dashboard"
echo ""
echo "Phone overlay must say: shell https://restorebraine.base44.app"
echo ""
