#!/usr/bin/env bash
# Re-sync Base44 to Omega baseline + kept fixes, THEN Capacitor native (hosted).
#
# Phase 1 — BASE44 WEB (do first, wait for Publish)
#   • omega-v4-core gallery / folders / Back to Gallery
#   • Launch screen, NativeLoginCard, logout fixes (from git — not v162 live site)
#   • Generates base44-publish-v{N}.txt — ONE full paste → Publish
#
# Phase 2 — CAPACITOR NATIVE (after Base44 live matches git)
#   • Hosted shell (Omega model): server.url → restorebraine.base44.app
#   • Full replace on every Xcode Run/Archive
#
# Usage:
#   bash scripts/mac-resync-omega.sh              # both phases (pauses for Base44 Publish)
#   bash scripts/mac-resync-omega.sh --base44-only
#   bash scripts/mac-resync-omega.sh --native-only   # after Publish succeeded
#   bash scripts/mac-resync-omega.sh --no-git
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
SKIP_GIT=0
PHASE=all
for arg in "$@"; do
  case "$arg" in
    --no-git) SKIP_GIT=1 ;;
    --base44-only) PHASE=base44 ;;
    --native-only) PHASE=native ;;
    -h|--help)
      cat <<HELP
Usage: bash scripts/mac-resync-omega.sh [--base44-only|--native-only] [--no-git]

  --base44-only   Phase 1 only: verify Omega + generate publish pack
  --native-only   Phase 2 only: hosted Capacitor full replace (run after Base44 Publish)
  --no-git        Skip git reset (already on latest branch)

After Phase 1: paste base44-publish-v*.txt into Base44 → Publish → verify Safari
After Phase 2: Xcode Clean → Run → Archive
HELP
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESYNC OMEGA — Base44 web first, then Capacitor native      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Omega baseline: gallery · folders · Back to Gallery (tag omega-v4-core)"
echo "Kept fixes:     launch screen · NativeLoginCard · logout · folder buttons"
echo "Architecture:   hosted WebView — NOT bundled capacitor://localhost"
echo ""

phase_base44() {
  if [ "$SKIP_GIT" = "0" ]; then
    echo "=== Sync git → origin/$BRANCH ==="
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    bash scripts/mac-ensure-development-team.sh 2>/dev/null || true
    echo "At: $(git log -1 --oneline)"
    echo ""
  fi

  echo "=== Verify Omega v4-core + auth (kept corrections) ==="
  node scripts/verify-omega-baseline.mjs
  node scripts/verify-auth-flow.mjs
  echo ""

  echo "=== Live Base44 drift check ==="
  node scripts/verify-base44-live.mjs || true
  echo ""

  echo "=== Generate Base44 publish pack from git (source of truth) ==="
  node scripts/embed-login-logo.mjs
  node scripts/generate-base44-publish.mjs
  echo ""

  DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

  cat <<EOF
════════════════════════════════════════════════════════════════
  PHASE 1 — BASE44: paste publish pack, then Publish ONCE
════════════════════════════════════════════════════════════════

  open base44-publish-v${DEPLOY}.txt

  For EACH "BASE44 PATH:" block:
    1. Open that exact path in Base44 Code editor
    2. Select All → Paste → Save
  After ALL blocks saved → click Publish ONCE

  Or: bash scripts/base44-publish-copy-commands.sh  (pbcopy per file)

  Verify in Terminal:
    node scripts/verify-base44-live.mjs

  Verify in Safari (private tab):
    https://restorebraine.base44.app
    • Google + Apple + Microsoft + email login
    • Folders tab buttons
    • Account → Back to Gallery (no sign-out)
    • View Source: restorebraine-deploy content="v${DEPLOY}"

  When verify-base44-live shows OK → run Phase 2:
    bash scripts/mac-resync-omega.sh --native-only

EOF
}

phase_native() {
  echo "=== Pre-flight: Base44 must match git before Capacitor ==="
  if ! node scripts/verify-base44-live.mjs; then
    echo ""
    echo "STOP: Publish Base44 first (Phase 1)."
    echo "  bash scripts/mac-resync-omega.sh --base44-only"
    exit 1
  fi
  echo ""

  echo "=== Phase 2: Capacitor hosted + full Xcode replace ==="
  bash scripts/mac-xcode-full-replace.sh --hosted
  echo ""

  bash scripts/mac-pre-upload-checklist.sh || true

  BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
  DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

  cat <<EOF
════════════════════════════════════════════════════════════════
  PHASE 2 COMPLETE — Capacitor v${BUILD_NUM} · Base44 v${DEPLOY}
════════════════════════════════════════════════════════════════

  open ios/App/App.xcworkspace

  1. Product → Clean Build Folder
  2. Product → Run on iPhone
     Build log MUST show:
       FULL REPLACE: copied ... files into App.app/public
       Restorebraine DEPLOY OK: public/ -> App.app
  3. Badge: native-hosted · restorebraine.base44.app
  4. Test login (same as Safari)
  5. Clean → Archive → Upload

  bash scripts/verify-hosted-app-bundle.sh

  DO NOT USE: mac-capacitor-web-sync.sh · mac-ios-v4-deploy.sh

EOF
}

case "$PHASE" in
  base44) phase_base44 ;;
  native) phase_native ;;
  all)
    phase_base44
    echo ""
    read -r -p "Published to Base44 and verify-base44-live OK? (y/N) " PUBLISHED
    if [[ ! "$PUBLISHED" =~ ^[Yy]$ ]]; then
      echo ""
      echo "Finish Base44 Publish, then:"
      echo "  node scripts/verify-base44-live.mjs"
      echo "  bash scripts/mac-resync-omega.sh --native-only"
      exit 0
    fi
    echo ""
    phase_native
    ;;
esac
