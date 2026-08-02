#!/usr/bin/env bash
# revert-to-v87-everywhere.sh — undo ALL post-v87 drift on GitHub + Capacitor + Base44
#
# Reverts TO v87 baseline (f1b2505 hosted), not away from v87 to Omega 3.
# Base44 has no CLI — browser Publish of all 71 manifest files is required.
#
# Usage:
#   npm run revert:v87-all
#   npm run revert:v87-all -- --yes              # skip iPhone delete/restart prompts
#   npm run revert:v87-all -- --verify-only      # probe all three layers, change nothing
#   npm run revert:v87-all -- --github-only      # git reset only
#   npm run revert:v87-all -- --capacitor-only   # nuke + rebuild iOS shell only
#   npm run revert:v87-all -- --base44-only      # print Base44 paste checklist only
#   npm run revert:v87-all -- --skip-base44-halt # continue after Capacitor even if Base44 stale
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${REVERT_V87_BRANCH:-cursor/apple-privacy-plist-bacf}"
V87_COMMIT="${NUKE_V87_COMMIT:-f1b2505}"
V87_UI="${V87_UI_COMMIT:-5762b16}"

VERIFY_ONLY=0
GITHUB_ONLY=0
CAPACITOR_ONLY=0
BASE44_ONLY=0
SKIP_BASE44_HALT=0
YES=0

for arg in "$@"; do
  case "$arg" in
    --verify-only) VERIFY_ONLY=1 ;;
    --github-only) GITHUB_ONLY=1 ;;
    --capacitor-only) CAPACITOR_ONLY=1 ;;
    --base44-only) BASE44_ONLY=1 ;;
    --skip-base44-halt) SKIP_BASE44_HALT=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help)
      cat << 'EOF'
Revert all post-v87 changes across GitHub, Capacitor, and Base44.

  npm run revert:v87-all                    Full revert (all layers)
  npm run revert:v87-all -- --verify-only   Read-only status check
  npm run revert:v87-all -- --github-only   Git reset to v87 branch
  npm run revert:v87-all -- --capacitor-only  nuke:v87 (hosted shell rebuild)
  npm run revert:v87-all -- --base44-only   Base44 paste checklist only
  npm run revert:v87-all -- --yes           Skip iPhone delete/restart prompts

To go back to bundled Omega 3 (NOT v87 — different architecture):
  git fetch origin --tags && git reset --hard omega-3 && bash build-iphone.sh --no-git
EOF
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

fail() {
  echo
  echo "✗ $1"
  exit "${2:-1}"
}

banner "REVERT TO v87 EVERYWHERE — undo all post-v87 drift"
echo " Target:  v87 tip ${V87_COMMIT} + UI ${V87_UI} (hosted Capacitor)"
echo " Branch:  origin/${BRANCH}"
echo " Base44:  https://restorebraine.base44.app (71-file full Publish required)"
echo
echo " This reverts TO v87. It does NOT roll back to bundled Omega 3."
echo " Omega 3 reference: npm run omega:v87-ref"
echo

if [[ "$BASE44_ONLY" == "1" ]]; then
  node scripts/print-base44-nuke-checklist.mjs
  echo
  echo "Paste workflow (already done in chat groups):"
  echo "  ls base44-paste-chat/CHAT-*.txt"
  echo "  npm run base44:remaining -- chat 1   # copy group to clipboard"
  echo
  echo "After Publish: npm run why:no-change"
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside restorebraine git repo."
fi

# ── VERIFY ONLY ─────────────────────────────────────────────────────────────
if [[ "$VERIFY_ONLY" == "1" ]]; then
  banner "VERIFY — all three layers (read-only)"
  node scripts/verify-v87-baseline.mjs || true
  node scripts/verify-no-post-v87-lingering.mjs --strict || true
  node scripts/prove-live-oauth.mjs || true
  node scripts/diagnose-chunk-pair.mjs || true
  node scripts/explain-no-change.mjs || true
  echo
  node scripts/gate-five-patterns.mjs || fail "One or more layers still post-v87 — see above"
  banner "If all pass: Delete app → Restart iPhone → Xcode Clean → Run"
  exit 0
fi

# ── iPhone replace (before Mac changes) ─────────────────────────────────────
if [[ "$YES" == "1" ]]; then
  export REPLACE_APP_CONFIRMED=1
elif [[ "$GITHUB_ONLY" != "1" ]]; then
  banner "STEP 0 — Replace iPhone app (required before rebuild)"
  bash scripts/prompt-replace-iphone-app.sh --before-rebuild || fail "iPhone app must be deleted + restarted first"
fi

# ── LAYER 1: GitHub ───────────────────────────────────────────────────────────
if [[ "$CAPACITOR_ONLY" != "1" ]]; then
  banner "LAYER 1 — GitHub → v87 baseline"
  git fetch origin "$BRANCH" --tags
  git reset --hard "origin/$BRANCH"
  git clean -fd -- dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true
  node scripts/verify-v87-baseline.mjs || fail "GitHub not v87-clean after reset"
  node scripts/verify-no-post-v87-lingering.mjs --strict || fail "Post-v87 files still in git tree"
  echo "✓ GitHub at v87 ($(git rev-parse --short HEAD), app = ${V87_COMMIT})"
fi

if [[ "$GITHUB_ONLY" == "1" ]]; then
  echo
  echo "Next: npm run revert:v87-all -- --capacitor-only"
  exit 0
fi

# ── LAYER 2: Capacitor ────────────────────────────────────────────────────────
banner "LAYER 2 — Capacitor → hosted shell (nuke post-v87 artifacts)"
bash scripts/nuke-v87.sh "$BRANCH"
echo "✓ Capacitor rebuilt (hosted → restorebraine.base44.app)"

if [[ "$CAPACITOR_ONLY" == "1" ]]; then
  echo
  echo "Next: npm run revert:v87-all -- --base44-only"
  exit 0
fi

# ── LAYER 3: Base44 (browser — no CLI) ────────────────────────────────────────
banner "LAYER 3 — Base44 live JS (browser Publish required)"
echo " Terminal cannot revert Base44 — only overwrite + Publish in browser."
echo
node scripts/prove-live-oauth.mjs && OAUTH_OK=1 || OAUTH_OK=0
node scripts/diagnose-chunk-pair.mjs && CHUNK_OK=1 || CHUNK_OK=0

if [[ "$OAUTH_OK" == "1" && "$CHUNK_OK" == "1" ]]; then
  echo
  echo "✓ Base44 already on v87 (live chunks + OAuth OK)"
else
  echo
  echo "✗ Base44 still has post-v87 or stale live JS — browser Publish required:"
  echo
  node scripts/print-base44-nuke-checklist.mjs | head -60
  echo "  ... (full list: npm run base44:nuke-list)"
  echo
  echo " FASTEST paste path (you already have chat groups):"
  echo "   cd ~/restorebraine/base44-paste-chat"
  echo "   for n in \$(seq -w 1 34); do"
  echo "     echo \"=== Paste CHAT-\$n.txt in Base44 AI → wait for write ===\""
  echo "     cat CHAT-\${n}.txt | pbcopy"
  echo "     read -p \"Paste CHAT-\$n, press Enter when done...\""
  echo "   done"
  echo "   # Then Publish ONCE in Base44"
  echo
  echo " OR one pack:"
  echo "   npm run base44:export-pack"
  echo "   # paste BASE44-PASTE-PACK-v87.txt → Publish once"
  echo
  echo " Confirm after Publish:"
  echo "   npm run why:no-change"
  echo "   npm run revert:v87-all -- --verify-only"
  echo

  if [[ "$SKIP_BASE44_HALT" != "1" ]]; then
    fail "Stop here — complete Base44 Publish, then: npm run revert:v87-all -- --verify-only" 2
  fi
fi

# ── FINAL ─────────────────────────────────────────────────────────────────────
banner "REVERT TO v87 — Mac layers complete"
node scripts/explain-no-change.mjs || true

if [[ "$YES" == "1" ]]; then
  echo "✓ iPhone replace acknowledged (--yes)"
else
  bash scripts/prompt-replace-iphone-app.sh --before-xcode
fi

echo
echo " Xcode: Product → Clean Build Folder → Run (fresh install)"
echo
echo " DO NOT USE after revert (re-introduces post-v87 regressions):"
echo "   npm run build:native-local"
echo "   NativeLoginCard / SignInScreen / LoginPage"
echo "══════════════════════════════════════════════════════════════"
