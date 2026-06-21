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
  PUBLISH="base44-publish-v${DEPLOY}.txt"
  BLOCKS=$(grep -c 'BASE44 PATH:' "$PUBLISH" 2>/dev/null || echo 0)

  cat <<EOF
════════════════════════════════════════════════════════════════
  PHASE 1 — BASE44 (use the wizard — NOT the giant txt file)
════════════════════════════════════════════════════════════════

  bash scripts/base44-publish-wizard.sh

  • Keeps Base44 Code editor open
  • Each step: Terminal copies 1 file → you Paste into that path → Save → Enter
  • ${BLOCKS} files total — Publish ONCE at the end
  • Guide: docs/BASE44-PUBLISH.md

  Resume if interrupted:
    bash scripts/base44-publish-wizard.sh 12

  Verify:
    node scripts/verify-base44-live.mjs

  Safari: https://restorebraine.base44.app
    • Google + Apple + Microsoft + email login
    • View Source: restorebraine-deploy content="v${DEPLOY}"

  When verify-base44-live shows OK → Phase 2:
    bash scripts/mac-resync-omega.sh --native-only

EOF
}

phase_native() {
  echo "=== Phase 2: one-shot full Xcode replace (no Base44 paste) ==="
  bash scripts/mac-build.sh --no-git "$@"
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
      echo "Skip Base44 — build iPhone app directly:"
      echo "  bash scripts/mac-build.sh"
      echo ""
      echo "Or finish Base44 Publish, then:"
      echo "  bash scripts/mac-build.sh --hosted"
      exit 0
    fi
    echo ""
    phase_native
    ;;
esac
