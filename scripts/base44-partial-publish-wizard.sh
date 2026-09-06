#!/usr/bin/env bash
# Re-publish only the files that often stay stale after a full 46-file wizard.
# Use when audit section 8 fails but section 3 (bundle markers) passes.
#
# Usage: bash scripts/base44-partial-publish-wizard.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

FILES=(
  "index.html"
  "src/deploy-marker.js"
  "public/hosted-runtime-guard.js"
  "src/pages/Account.jsx"
  "src/components/RuntimeDiagnostic.jsx"
)

copy_file() {
  pbcopy < "$1"
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Base44 PARTIAL Publish — v${DEPLOY} (5 fingerprint + stale files) ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Run this when audit section 8 shows:"
echo "  • Stripe intercept BROKEN"
echo "  • hosted-runtime-guard overlay OLD"
echo "  • RuntimeDiagnostic missing from live bundle"
echo ""
echo "These 5 files must be saved in Base44, then click PUBLISH once."
echo ""
read -r -p "Ready? (y/N) " READY
if [[ ! "$READY" =~ ^[Yy]$ ]]; then
  echo "Run again when ready: bash scripts/base44-partial-publish-wizard.sh"
  exit 0
fi

TOTAL=${#FILES[@]}
idx=0
while [ "$idx" -lt "$TOTAL" ]; do
  n=$((idx + 1))
  f="${FILES[$idx]}"
  copy_file "$f"

  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo "  FILE ${n} of ${TOTAL}"
  echo "────────────────────────────────────────────────────────────"
  echo ""
  echo "  In Base44 Code editor, open:"
  echo ""
  echo "      ${f}"
  echo ""
  echo "  Then:  Select All  →  Paste  →  Save"
  echo "  (code is already on your clipboard)"
  echo ""

  if [ "$n" -eq "$TOTAL" ]; then
    echo "  >>> LAST FILE. After Save, click PUBLISH in Base44. <<<"
    read -r -p "Saved ${f}? Press Enter to finish…" _
    break
  fi

  read -r -p "Saved ${f}? Press Enter for next file…" _
  idx=$((idx + 1))
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  5 FILES DONE — click PUBLISH in Base44 now"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "IMPORTANT — Save alone does NOT update the live site."
echo "  1. In Base44 dashboard, click the PUBLISH button (top-right or Deploy tab)"
echo "  2. Wait until the build finishes (can take 1–3 minutes)"
echo "  3. Do NOT run Xcode verify until audit passes:"
echo ""
echo "     node scripts/audit-base44-bundle.mjs"
echo ""
echo "  If section 8 still shows BROKEN/OLD, Publish did not apply — retry Publish."
echo "  After audit PASS, bundle hash should change from index-DH2_Ello.js."
echo ""
echo "Then Xcode (if not already Run):"
echo "  open ios/App/App.xcworkspace"
echo "  Delete app → Clean Build Folder → Run (Cmd+R)"
echo ""
