#!/usr/bin/env bash
# Master horizontal deployment audit — SOURCE → CDN → Capacitor.
# Does NOT assume Base44 Publish succeeded; proves artifacts at each layer.
#
# Usage: bash scripts/verify-deployment-audit.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0

section() {
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo "  $1"
  echo "══════════════════════════════════════════════════════════════"
}

run() {
  local name="$1"
  shift
  section "$name"
  if "$@"; then
    echo ""
    echo "  → $name: PASS"
  else
    echo ""
    echo "  → $name: FAIL (exit $?)"
    FAIL=1
  fi
}

section "RESTOREBRAINE DEPLOYMENT AUDIT"
echo ""
echo "  Git:     $(git rev-parse --short HEAD) ($(git branch --show-current))"
echo "  Live:    https://restorebraine.base44.app"
echo "  App ID:  68fdc5f42768c4d045fe1bac"
echo ""
echo "  This audit traces source → CDN → Capacitor without assuming Publish worked."

run "1/4 — Deployment trace (horizontal)" node scripts/verify-deployment-trace.mjs
run "2/4 — Base44 publish applied (Stripe + guard)" bash scripts/verify-base44-publish-applied.sh
run "3/4 — Base44 bundle audit" node scripts/audit-base44-bundle.mjs
run "4/4 — Layer discrepancy map" node scripts/audit-layer-discrepancies.mjs

section "AUDIT RESULT"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  RESULT: DEPLOYMENT VERIFIED (all layers PASS)"
  echo ""
  echo "  If iPhone still unchanged:"
  echo "    • Account → Runtime diagnostic — check source commit + build ID"
  echo "    • Delete app → Xcode Run (WKWebView cache)"
  echo "    • bash scripts/mac-no-change-now.sh"
else
  echo "  RESULT: DEPLOYMENT NOT VERIFIED — see FAIL sections above"
  echo ""
  echo "  Fix order:"
  echo "    1. node scripts/sync-source-fingerprint.mjs"
  echo "    2. bash scripts/base44-partial-publish-wizard.sh → Publish"
  echo "    3. Re-run: bash scripts/verify-deployment-audit.sh"
  echo ""
  echo "  Do NOT rebuild Xcode until CDN audit PASSes."
fi
echo ""
exit "$FAIL"
