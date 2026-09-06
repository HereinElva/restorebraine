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
  local code=0
  section "$name"
  "$@" || code=$?
  echo ""
  if [ "$code" -eq 0 ]; then
    echo "  → $name: PASS"
  else
    echo "  → $name: FAIL (exit $code)"
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
  echo "  CDN fingerprint is proven. Main app fixes (Stripe, guard, folders) are live."
  echo ""
  echo "  If iPhone still looks unchanged:"
  echo "    1. Safari private tab → View Source → confirm fingerprint matches audit"
  echo "    2. Delete app → Xcode Run (WKWebView cache)"
  echo "    3. Account → Runtime diagnostic — origin = restorebraine.base44.app"
  echo "    4. bash scripts/mac-no-change-now.sh"
  echo ""
  echo "  Optional: publish Account.jsx + RuntimeDiagnostic.jsx for on-device build ID UI"
else
  HEAD=$(git rev-parse --short HEAD)
  CDN_FP=$(curl -sL --max-time 20 "https://restorebraine.base44.app/?t=$(date +%s)" | node -e "
import { parseSourceCommitFromHtml } from './scripts/lib/parse-deploy-meta.mjs';
let h=''; process.stdin.on('data',d=>h+=d); process.stdin.on('end',()=>console.log(parseSourceCommitFromHtml(h)||''));
" 2>/dev/null || true)

  echo "  RESULT: DEPLOYMENT NOT VERIFIED — see FAIL sections above"
  echo ""
  if [ -n "$CDN_FP" ]; then
    echo "  CDN fingerprint on live: $CDN_FP (git HEAD: $HEAD)"
    if git merge-base --is-ancestor "$CDN_FP" HEAD 2>/dev/null; then
      UNPUBLISHED=$(git diff --name-only "$CDN_FP"..HEAD -- src/ index.html public/ 2>/dev/null | grep -v -E 'deploy-marker|RuntimeDiagnostic' || true)
      if [ -z "$UNPUBLISHED" ]; then
        echo "  NOTE: CDN matches last publish; HEAD only has tooling commits — trace should PASS after git pull"
      else
        echo "  Unpublished app files since CDN publish:"
        echo "$UNPUBLISHED" | sed 's/^/    • /'
      fi
    fi
  else
    echo "  CDN fingerprint: missing — publish index.html after npm run sync:source-fingerprint"
  fi
  echo ""
  echo "  Fix order when CDN truly stale:"
  echo "    1. npm run sync:source-fingerprint"
  echo "    2. bash scripts/base44-partial-publish-wizard.sh → Publish"
  echo "    3. npm run verify:deployment-audit"
fi
echo ""
exit "$FAIL"
