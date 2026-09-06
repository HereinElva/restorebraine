#!/usr/bin/env bash
# Quick check: did Base44 Publish actually update the live CDN?
# Run AFTER clicking Publish in Base44 dashboard (wait 60s first).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

LIVE="https://restorebraine.base44.app"
FAIL=0

HTML=$(curl -sL --max-time 20 "$LIVE/?t=$(date +%s)" || true)
GUARD=$(curl -sL --max-time 15 "$LIVE/hosted-runtime-guard.js" || true)
BUNDLE=$(echo "$HTML" | grep -o 'assets/index-[^"]*\.js' | head -1 | sed 's|assets/||')
DEPLOY=$(node -e "
const h=process.argv[1];
const t=h.match(/restorebraine-deploy[^>]*content=\"([^\"]+)\"/i)?.[0]
  ?? h.match(/content=\"([^\"]+)\"[^>]*restorebraine-deploy/i)?.[0];
const c=t?.match(/content=\"([^\"]+)\"/i)?.[1] ?? '';
const m=c.match(/^v?(\\d+)/);
console.log(m?'v'+m[1]:'?');
" "$HTML" 2>/dev/null || echo "?")
FINGERPRINT=$(node -e "
const h=process.argv[1];
const names=['restorebraine-source-fingerprint','restorebraine-source-commit'];
for (const n of names) {
  const tag=h.match(new RegExp('<meta[^>]*name=\"'+n+'\"[^>]*>','i'))?.[0]
    ?? h.match(new RegExp('content=\"([^\"]+)\"[^>]*name=\"'+n+'\"','i'));
  const c=tag?.match(/content=\"([^\"]+)\"/i)?.[1];
  if (c) { console.log(c); process.exit(0); }
}
const d=h.match(/restorebraine-deploy[^>]*content=\"v\\d+-([0-9a-f]+)\"/i)?.[1];
if (d) console.log(d);
" "$HTML" 2>/dev/null || true)

echo "=== Base44 Publish applied? ==="
echo ""
echo "Live deploy:  ${DEPLOY:-unknown}"
echo "Live fingerprint: ${FINGERPRINT:-missing}"
echo "Live bundle:  ${BUNDLE:-unknown}"
echo ""

if echo "$HTML" | grep -q 'return openInApp(u);}var a=Location'; then
  echo "OK:  Stripe intercept (return openInApp)"
else
  echo "FAIL: Stripe intercept still broken — index.html not on live CDN"
  FAIL=1
fi

if echo "$GUARD" | grep -q 'rbHostedRuntimeGuard'; then
  echo "OK:  hosted-runtime-guard overlay ($(echo -n "$GUARD" | wc -c | tr -d ' ') bytes)"
else
  echo "FAIL: hosted-runtime-guard still old ($(echo -n "$GUARD" | wc -c | tr -d ' ') bytes)"
  FAIL=1
fi

if [ "$BUNDLE" = "index-DH2_Ello.js" ]; then
  echo "WARN: bundle hash unchanged (index-DH2_Ello.js) — Publish may not have rebuilt JS"
  echo "      (OK if only index.html/public changed; RuntimeDiagnostic needs new hash)"
else
  echo "OK:  bundle hash changed to ${BUNDLE}"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "PASS — Base44 Publish reached live CDN"
  echo "Next: Safari private tab test, then delete app + Xcode Run"
  exit 0
fi

echo "FAIL — Publish NOT applied to live site yet"
echo ""
echo "In Base44 dashboard:"
echo "  1. Open Code editor — confirm index.html has: return openInApp(u)"
echo "  2. Click Publish (not just Save) — wait for build to finish"
echo "  3. Re-run: bash scripts/verify-base44-publish-applied.sh"
echo ""
echo "Or re-paste 4 files:"
echo "  bash scripts/base44-partial-publish-wizard.sh"
exit 1
