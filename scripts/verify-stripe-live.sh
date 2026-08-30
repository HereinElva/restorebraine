#!/usr/bin/env bash
# Quick check: did Base44 publish the Stripe in-app payment fix?
set -euo pipefail
URL="${1:-https://restorebraine.base44.app}"
html=$(curl -sL --max-time 15 "$URL")
scrub=$(curl -sL --max-time 15 "$URL/native-ui-scrub.js" 2>/dev/null || true)
guard=$(curl -sL --max-time 15 "$URL/stripe-native-guard.js" 2>/dev/null || true)
deploy=$(echo "$html" | grep -oE 'restorebraine-deploy[^>]*content="v[0-9]+"' | grep -oE 'v[0-9]+' | head -1 || true)

echo "Live deploy:     ${deploy:-unknown}"
echo ""

if echo "$scrub" | grep -q '__restorebraineStripePatchVersion = 292'; then
  echo "OK: native-ui-scrub.js has Stripe v292 patch (permanent bridge hook)"
elif echo "$scrub" | grep -q '__restorebraineStripePatchVersion = 291'; then
  echo "WARN: v291 only — update scrub to v292 (permanent hook)"
elif echo "$html" | grep -q 'openInSystemBrowser'; then
  echo "OK: index.html has inline Stripe guard"
elif echo "$guard" | grep -q 'openInSystemBrowser'; then
  echo "OK: stripe-native-guard.js has InAppBrowser patch"
else
  echo "FAIL: Stripe in-app patch not found on live site"
  echo ""
  echo "Fix: paste public/native-ui-scrub.js in Base44 → Save → Publish"
  echo "See docs/STRIPE-BASE44-FIX.md"
  exit 1
fi

if [[ "$deploy" == "v288" ]] || [[ "$deploy" == "v289" ]]; then
  echo "OK: deploy stamp is ${deploy}"
else
  echo "NOTE: deploy stamp is ${deploy:-unknown} — scrub patch alone can still fix payment"
fi

echo ""
echo "After Publish: force-quit app, reopen, try Pay again."
