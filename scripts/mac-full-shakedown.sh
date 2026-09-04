#!/usr/bin/env bash
# Complete shakedown + rebuild — GitHub, Base44 audit, Capacitor shell, native files.
# References Omega 7 → v295 corrections and Stripe persistent block diagnosis.
#
# Usage:
#   bash scripts/mac-full-shakedown.sh              # audit only
#   bash scripts/mac-full-shakedown.sh --rebuild      # audit + native full rebuild
#   bash scripts/mac-full-shakedown.sh --rebuild --publish-wizard  # + launch Base44 wizard
#
# Base44 Publish cannot be automated — must click Publish in Base44 dashboard.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REBUILD=0
PUBLISH_WIZARD=0
BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-folder-persistence-bacf}"

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --publish-wizard) PUBLISH_WIZARD=1 ;;
    -h|--help)
      cat <<HELP
Restorebraine full shakedown — Omega 7 lineage + all layers

  bash scripts/mac-full-shakedown.sh
      Run complete audit (GitHub, Base44 live, Capacitor, Stripe block analysis)

  bash scripts/mac-full-shakedown.sh --rebuild
      Audit, then: sync GitHub → wipe ghosts → hosted Capacitor rebuild

  bash scripts/mac-full-shakedown.sh --rebuild --publish-wizard
      Above + start Base44 partial publish wizard (4 stale-trap files)

CANNOT automate:
  • Base44 Publish button (CDN update)
  • Xcode Product → Run to iPhone

After audit shows Base44 blockers:
  1. bash scripts/base44-partial-publish-wizard.sh
  2. Click PUBLISH in Base44 dashboard
  3. bash scripts/verify-base44-publish-applied.sh  (must PASS)
  4. bash scripts/mac-full-shakedown.sh --rebuild
  5. Xcode: Delete app → Clean → Run

Omega 7 (v107) was BUNDLED — current App Store path is HOSTED (Base44 live UI).
Stripe persistent block: live index.html has broken intercept; git has fix; Publish required.
HELP
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  FULL SHAKEDOWN — Omega 7 → v295 · all layers                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Phase 1: Sync git (light — full rebuild does hard reset if --rebuild) ─────
echo "=== Phase 1/4: GitHub sync ==="
git fetch origin "$BRANCH" 2>/dev/null || true
CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
if [ "$CURRENT" != "$BRANCH" ]; then
  echo "WARN: on $CURRENT — switching to $BRANCH"
  git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
fi
if [ "$REBUILD" = "1" ]; then
  git reset --hard "origin/$BRANCH"
fi
echo "OK: $(git rev-parse --short HEAD) on $BRANCH"
echo ""

# ── Phase 2: Full audit ───────────────────────────────────────────────────────
echo "=== Phase 2/4: Full shakedown audit ==="
AUDIT_EXIT=0
node scripts/audit-blindspots.mjs || true
node scripts/audit-full-shakedown.mjs || AUDIT_EXIT=$?
echo ""

# ── Phase 3: Native rebuild (optional) ────────────────────────────────────────
if [ "$REBUILD" = "1" ]; then
  echo "=== Phase 3/4: Native shell full rebuild ==="
  bash scripts/mac-complete-rebuild.sh --skip-audit
  echo ""
else
  echo "=== Phase 3/4: Native rebuild SKIPPED (pass --rebuild to run) ==="
  echo "  bash scripts/mac-full-shakedown.sh --rebuild"
  echo ""
fi

# ── Phase 4: Base44 + Xcode handoff ───────────────────────────────────────────
echo "=== Phase 4/4: Base44 Publish + Xcode (manual) ==="
BASE44_EXIT=0
bash scripts/verify-base44-publish-applied.sh || BASE44_EXIT=$?

if [ "$BASE44_EXIT" -ne 0 ]; then
  echo ""
  echo "████████████████████████████████████████████████████████████"
  echo "██  BASE44 CDN BLOCKED — this is why you see no change     ██"
  echo "████████████████████████████████████████████████████████████"
  echo ""
  echo "Native shell is ready. Live site still serves OLD index.html + guard."
  echo ""
  echo "Do NOW (Base44 dashboard):"
  echo "  npm run base44:editor-check"
  echo "  bash scripts/base44-partial-publish-wizard.sh"
  echo "  Click PUBLISH → wait for build → verify:"
  echo "  bash scripts/verify-base44-publish-applied.sh"
  echo ""
  if [ "$PUBLISH_WIZARD" = "1" ]; then
    echo "Launching partial publish wizard..."
    bash scripts/base44-partial-publish-wizard.sh || true
  fi
else
  echo ""
  echo "OK: Base44 live CDN matches git — proceed to iPhone test"
fi

echo ""
echo "Xcode (always required for device install):"
echo "  1. Xcode → Settings → Accounts → add Apple ID (if missing)"
echo "  2. Delete Restorebraine from iPhone"
echo "  3. open ios/App/App.xcworkspace"
echo "  4. Select physical iPhone → Clean Build Folder → Run (Cmd+R)"
echo "  5. Build log: Restorebraine DEPLOY OK"
echo "  6. bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "On-device: Account → Runtime diagnostic"
echo "  origin must be restorebraine.base44.app"
echo "  purple overlay: shell https://restorebraine.base44.app"
echo ""

if [ "$AUDIT_EXIT" -ne 0 ] || [ "$BASE44_EXIT" -ne 0 ]; then
  echo "SHAKEDOWN: issues remain — fix Base44 Publish first, then --rebuild + Xcode Run"
  exit 1
fi

echo "SHAKEDOWN PASS — all layers harmonized"
exit 0
