#!/usr/bin/env bash
# reset-v87-all.sh — full v87 reset across GitHub + Capacitor + Base44 verification
#
# Automates: git reset, Capacitor nuke/rebuild, live Base44 probe, full diagnostics.
# Base44 Publish itself is browser-only — script detects if it's needed and stops with checklist.
#
# Usage:
#   bash scripts/reset-v87-all.sh
#   npm run reset:v87-all
#   npm run reset:v87-all -- --skip-capacitor    # git + verify only (fast)
#   npm run reset:v87-all -- --verify-only       # no reset, diagnose only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${RESET_V87_BRANCH:-cursor/apple-privacy-plist-bacf}"
V87_COMMIT="${NUKE_V87_COMMIT:-f1b2505}"
SKIP_CAPACITOR=0
VERIFY_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --skip-capacitor) SKIP_CAPACITOR=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    -h|--help)
      echo "Usage: bash scripts/reset-v87-all.sh [--skip-capacitor] [--verify-only]"
      exit 0
      ;;
  esac
done

banner() {
  echo
  echo "══════════════════════════════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════════════════════════════"
}

run_node() {
  node "$@"
}

fail() {
  echo
  echo "✗ $1"
  exit "${2:-1}"
}

banner "v87 FULL RESET — GitHub + Capacitor + Base44"
echo " Repo:   $ROOT"
echo " Branch: origin/$BRANCH"
echo " v87 tip: $V87_COMMIT (app source)"
echo " Mode:   hosted Capacitor → https://restorebraine.base44.app"
echo

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside restorebraine git repo."
fi

# ── PHASE 0: Pre-flight (read-only analysis) ───────────────────────────────
banner "PHASE 0 — Pre-flight analysis (read-only)"
echo "Checking current state before any changes..."
echo
run_node scripts/prove-live-oauth.mjs || LIVE_BEFORE=$?
LIVE_BEFORE="${LIVE_BEFORE:-0}"
echo
run_node scripts/verify-v87-baseline.mjs || true
echo

if [[ "$VERIFY_ONLY" == "1" ]]; then
  banner "VERIFY ONLY — running full diagnostics"
  run_node scripts/diagnose-all.mjs
  run_node scripts/gate-pre-update.mjs
  exit 0
fi

# ── PHASE 1: GitHub — hard reset to v87 branch ─────────────────────────────
banner "PHASE 1 — GitHub reset (v87 app + diagnostic scripts)"
echo "==> git fetch origin $BRANCH --tags"
git fetch origin "$BRANCH" --tags

echo "==> git reset --hard origin/$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> git clean -fd dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true"
git clean -fd -- dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true

echo "==> verify v87 baseline"
run_node scripts/verify-v87-baseline.mjs || fail "GitHub is not v87-clean after reset."

# ── PHASE 2: Capacitor — nuke + rebuild hosted shell ───────────────────────
if [[ "$SKIP_CAPACITOR" == "1" ]]; then
  banner "PHASE 2 — Capacitor (SKIPPED — --skip-capacitor)"
  run_node scripts/use-local-native-bundle.mjs --hosted
else
  banner "PHASE 2 — Capacitor nuke + rebuild (hosted mode only)"
  bash scripts/nuke-v87.sh "$BRANCH"
fi

# ── PHASE 3: Base44 live probe ─────────────────────────────────────────────
banner "PHASE 3 — Base44 live probe (what iPhone actually runs)"
if run_node scripts/prove-live-oauth.mjs; then
  echo
  echo "✓ Live Base44 OAuth already on restorebraine.base44.app"
else
  echo
  echo "✗ Live Base44 OAuth NOT fixed — browser Publish required (cannot automate from terminal)"
  echo
  echo "  1. Open Base44 code editor for Restorebraine"
  echo "  2. Run: npm run base44:nuke-list"
  echo "  3. Paste EVERY listed file → click Publish ONCE"
  echo "  4. Watch: npm run diagnose:watch"
  echo "  5. Re-run: npm run reset:v87-all -- --verify-only"
  echo
  echo "  Quick OAuth-only paste pack: cat BASE44-PASTE-PACK-v87.txt"
  echo "  Or export fresh: npm run base44:export-pack"
  echo
  npm run base44:nuke-list -- --minimal 2>/dev/null || true
  fail "Stop here — complete Base44 Publish, then: npm run reset:v87-all -- --verify-only" 2
fi

# ── PHASE 4: Full three-layer verification ─────────────────────────────────
banner "PHASE 4 — Full verification (all three layers must agree)"
run_node scripts/verify-no-post-v87-lingering.mjs --strict
run_node scripts/diagnose-all.mjs
run_node scripts/gate-pre-update.mjs

banner "v87 FULL RESET COMPLETE — all layers aligned"
echo " HEAD: $(git rev-parse --short HEAD)"
echo " BUILD_STAMP: $(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)"
echo
echo " iPhone (required even when diagnostics pass):"
echo "   1. Delete Restorebraine app"
echo "   2. Restart iPhone"
echo "   3. Xcode → Clean Build Folder → Run"
echo "   4. Tap Sign In on Find Your Memories"
echo
echo " Before ANY future update:"
echo "   npm run gate:pre-update"
echo
echo " DO NOT USE (re-introduces post-v87 regressions):"
echo "   npm run build:native-local"
echo "   New login components (NativeLoginCard, SignInScreen, LoginPage)"
echo "══════════════════════════════════════════════════════════════"
