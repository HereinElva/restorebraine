#!/usr/bin/env bash
# START FRESH — Omega hosted architecture + kept UI fixes + full Xcode replace.
#
# Restores what worked in Omega / App Store build 1.0.1 (3):
#   • Capacitor loads live https://restorebraine.base44.app (NOT bundled localhost)
#   • Login works like Safari after Base44 Publish
#   • Every Xcode Run/Archive fully replaces App.app/public/ (rm -rf + ditto)
#
# Keeps subsequent fixes (does NOT revert):
#   • Launch screen (logo, light gradient, white title)
#   • Back to Gallery (data-rb-gallery-nav)
#   • Folder tab buttons (Omega v4-core gallery baseline)
#   • NativeLoginCard login UI
#
# Usage:
#   bash scripts/mac-start-fresh.sh
#   bash scripts/mac-start-fresh.sh --no-git    # skip git reset (already synced)
#
# All steps run in Terminal. Then paste Base44 publish pack + Xcode Archive.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
SKIP_GIT=0
for arg in "$@"; do
  case "$arg" in
    --no-git) SKIP_GIT=1 ;;
    -h|--help)
      echo "Usage: bash scripts/mac-start-fresh.sh [--no-git]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESTOREBRAINE START FRESH                                   ║"
echo "║  Omega hosted shell · gallery/folders kept · full replace    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Reference: omega-v4-core (gallery) + appstore-1.0.1-build3 (hosted login)"
echo "Docs: docs/START-FRESH.md"
echo ""

if [ "$SKIP_GIT" = "0" ]; then
  echo "=== Step 1: sync repo to origin/$BRANCH ==="
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  rm -rf ios/App/App/public
  mkdir -p ios/App/App/public/assets
  bash scripts/mac-ensure-development-team.sh 2>/dev/null || true
  echo "At: $(git log -1 --oneline)"
  echo ""
else
  echo "=== Step 1: skipped (--no-git) ==="
  echo ""
fi

echo "=== Step 2: verify Omega gallery/folders/back-to-gallery baseline ==="
node scripts/verify-omega-baseline.mjs
node scripts/verify-auth-flow.mjs
echo ""

echo "=== Step 3: full wipe + hosted rebuild (complete replacement) ==="
bash scripts/mac-xcode-full-replace.sh --hosted
echo ""

echo "=== Step 4: generate Base44 publish pack (web + Capacitor must match) ==="
node scripts/generate-base44-publish.mjs
echo ""

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json | head -1 || echo missing)

echo "=== Step 5: pre-upload checks ==="
bash scripts/mac-pre-upload-checklist.sh || true
echo ""

cat <<EOF
════════════════════════════════════════════════════════════════
  START FRESH COMPLETE — v${BUILD_NUM} · deploy v${DEPLOY}
════════════════════════════════════════════════════════════════

THREE TARGETS (must all match):

  1) BASE44 WEB — paste publish pack, then Publish
  2) CAPACITOR iOS — hosted shell (server.url below)
  3) XCODE — full replace on every Run/Archive

Capacitor config: ${URL}
Local bundle entry: ${ENTRY}
Publish file: base44-publish-v${DEPLOY}.txt  (or part1/2/3)

────────────────────────────────────────────────────────────────
TERMINAL — Base44 (do this BEFORE Xcode Archive)
────────────────────────────────────────────────────────────────

  bash scripts/base44-publish-copy-commands.sh

  Or open base44-publish-v${DEPLOY}.txt → paste each BASE44 PATH block
  into Base44 Code editor → Save → Publish once.

  Verify in Safari (private tab):
    https://restorebraine.base44.app
    • Google / Apple / email login works
    • Folders tab buttons look correct
    • Account → Back to Gallery does NOT sign you out

────────────────────────────────────────────────────────────────
TERMINAL + XCODE — iPhone / App Store
────────────────────────────────────────────────────────────────

  open ios/App/App.xcworkspace

  1. Product → Clean Build Folder
  2. Product → Run (Cmd+R) on iPhone — build log MUST show:
       FULL REPLACE: copied ... files into App.app/public
       Restorebraine DEPLOY OK: public/ -> App.app
  3. Purple badge: mode native-hosted · origin restorebraine.base44.app
  4. Product → Clean Build Folder
  5. Product → Archive → Distribute → App Store Connect

  Verify after Run:
    bash scripts/verify-hosted-app-bundle.sh

────────────────────────────────────────────────────────────────
DO NOT USE (breaks login — caused Apple Store build churn)
────────────────────────────────────────────────────────────────

  bash scripts/mac-capacitor-web-sync.sh
  bash scripts/mac-ios-v4-deploy.sh

  Those bundle capacitor://localhost. Use this script instead.

EOF
