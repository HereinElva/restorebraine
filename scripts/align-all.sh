#!/usr/bin/env bash
# align-all.sh — terminal-first three-layer alignment (GitHub + Capacitor + Base44 probe)
#
# Automates everything the terminal CAN do. Base44 Publish is browser-only;
# when live chunks fail, script stops with paste checklist + watch command.
#
# Usage:
#   npm run align:all
#   npm run align:all -- --skip-capacitor    # git + web build + probes only
#   npm run align:all -- --skip-build        # probes only (fast)
#   npm run align:all -- --no-git-sync       # skip fetch/reset (re-verify after Publish)
#   npm run align:all -- --fix-hosted         # force cap:hosted before build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${ALIGN_BRANCH:-cursor/apple-privacy-plist-bacf}"
SKIP_CAPACITOR=0
SKIP_BUILD=0
FIX_HOSTED=0
NO_GIT_SYNC=0

for arg in "$@"; do
  case "$arg" in
    --skip-capacitor) SKIP_CAPACITOR=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --fix-hosted) FIX_HOSTED=1 ;;
    --no-git-sync) NO_GIT_SYNC=1 ;;
    -h|--help)
      echo "Usage: bash scripts/align-all.sh [--skip-capacitor] [--skip-build] [--fix-hosted]"
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

run() {
  echo "==> $*"
  "$@"
}

fail_with_base44() {
  echo
  echo "✗ $1"
  echo
  echo " TERMINAL DONE — GitHub + Capacitor aligned. Live Base44 needs browser Publish."
  echo
  echo " 1. npm run base44:export-pack     # or base44:copy-commands"
  echo " 2. Open Base44 code editor → paste ALL 43 files → Publish ONCE"
  echo " 3. npm run align:watch            # terminal polls until chunks match"
  echo " 4. npm run align:all -- --skip-build   # re-verify all layers"
  echo
  exit "${2:-2}"
}

banner "ALIGN ALL — GitHub + Capacitor + Base44 (terminal-first)"
echo " Branch: origin/$BRANCH"
echo " Mode:   hosted Capacitor → https://restorebraine.base44.app"
echo

# Replace app on iPhone before Mac rebuild (skip on quick re-verify)
if [[ "$NO_GIT_SYNC" != "1" ]] || [[ "$SKIP_CAPACITOR" != "1" ]]; then
  banner "REQUIRED — Replace iPhone app before rebuild"
  bash scripts/prompt-replace-iphone-app.sh --before-rebuild
fi

# ── PATTERN 4: Lock hosted mode ─────────────────────────────────────────────
banner "PHASE 1 — Pattern 4: lock hosted mode (no bundled flip-flop)"
if [[ "$FIX_HOSTED" == "1" ]]; then
  run node scripts/use-local-native-bundle.mjs --hosted
fi
if grep -q 'appStartPath' capacitor.config.json 2>/dev/null; then
  echo "✗ appStartPath found — run: npm run cap:hosted"
  exit 1
fi
echo "✓ Hosted mode (no appStartPath)"

# ── PATTERN 1: GitHub sync ──────────────────────────────────────────────────
banner "PHASE 2 — Pattern 1: GitHub sync (source of truth)"
if [[ "$NO_GIT_SYNC" == "1" ]]; then
  echo "(skipped — --no-git-sync)"
else
  run git fetch origin "$BRANCH" --tags
  run git reset --hard "origin/$BRANCH"
  run git clean -fd -- dist ios/App/build node_modules/.vite 2>/dev/null || true
fi
run node scripts/verify-v87-baseline.mjs

# ── PATTERN 5: No login rewrites ────────────────────────────────────────────
banner "PHASE 3 — Pattern 5: block login rewrites + post-v87 artifacts"
run node scripts/verify-no-post-v87-lingering.mjs --strict

# ── Capacitor rebuild ───────────────────────────────────────────────────────
if [[ "$SKIP_CAPACITOR" == "1" ]]; then
  banner "PHASE 4 — Capacitor (SKIPPED — --skip-capacitor)"
else
  banner "PHASE 4 — Capacitor shell rebuild (hosted fallback bundle)"
  if [[ -f scripts/mac-ios-setup.sh ]]; then
    run bash scripts/mac-ios-setup.sh "$BRANCH"
  else
    run npm run build
  fi
fi

# ── Web build for chunk comparison ──────────────────────────────────────────
if [[ "$SKIP_BUILD" == "1" ]]; then
  banner "PHASE 5 — Web build (SKIPPED — --skip-build)"
else
  banner "PHASE 5 — Web build (dist for chunk pair comparison)"
  run npm run build:web
fi

# ── Live Base44 probes ──────────────────────────────────────────────────────
banner "PHASE 6 — Live Base44 probes (Patterns 2 + 3)"
echo "OAuth probe:"
if ! run node scripts/prove-live-oauth.mjs; then
  fail_with_base44 "Live OAuth not fixed" 2
fi

echo
echo "Chunk pair probe (detects partial Publish):"
if ! run node scripts/diagnose-chunk-pair.mjs; then
  fail_with_base44 "Mixed index/App chunks — partial Publish or Publish not done yet" 2
fi

# ── Full diagnostics + five-pattern gate ────────────────────────────────────
banner "PHASE 7 — Full diagnostics + five-pattern gate"
run node scripts/diagnose-sync-depth.mjs
run node scripts/diagnose-all.mjs
run node scripts/gate-five-patterns.mjs

banner "ALL LAYERS ALIGNED"
echo " HEAD: $(git rev-parse --short HEAD)"
echo " BUILD_STAMP: $(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)"
echo

banner "REQUIRED — Replace iPhone app before Xcode Run"
bash scripts/prompt-replace-iphone-app.sh --before-xcode

echo " Xcode steps (after app replace confirmed above):"
echo "   1. Product → Clean Build Folder"
echo "   2. Run on iPhone (fresh install — not an update)"
echo "   3. Tap Sign In on Find Your Memories"
echo
echo " Before future updates: npm run gate:patterns"
echo "══════════════════════════════════════════════════════════════"
