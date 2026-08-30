#!/usr/bin/env bash
# Quick check: did Base44 publish include the Stripe payment fix?
set -euo pipefail
URL="${1:-https://restorebraine.base44.app}"
html=$(curl -sL --max-time 15 "$URL")
deploy=$(echo "$html" | grep -oE 'restorebraine-deploy[^>]*content="v[0-9]+"' | grep -oE 'v[0-9]+' | head -1 || true)
app=$(echo "$html" | grep -oE 'assets/App-[A-Za-z0-9_-]+\.js' | head -1 || true)
guard=$(curl -sL --max-time 15 "$URL/stripe-native-guard.js" 2>/dev/null || true)
inline_guard=$(echo "$html" | grep -c 'openInSystemBrowser' || true)

echo "Live deploy:     ${deploy:-unknown}"
echo "App bundle:      ${app:-unknown}"
echo ""

if [[ -z "$deploy" ]]; then
  echo "FAIL: no restorebraine-deploy meta tag"
  exit 1
fi

if [[ "$deploy" != "v288" ]]; then
  echo "FAIL: expected v288 — paste index.html + deploy-marker.js in Base44, then Publish"
  exit 1
fi
echo "OK: deploy stamp is v288"

if [[ "$inline_guard" -gt 0 ]]; then
  echo "OK: index.html has inline Stripe guard (openInSystemBrowser patch)"
elif echo "$guard" | grep -q 'openInSystemBrowser'; then
  echo "OK: stripe-native-guard.js has InAppBrowser patch"
else
  echo "FAIL: no Stripe guard patch found on live site"
  exit 1
fi

if [[ -n "$app" ]]; then
  bundle=$(curl -sL --max-time 15 "$URL/$app")
  if echo "$bundle" | grep -q 'openInSystemBrowser||'; then
    echo "WARN: App bundle still uses openInSystemBrowser first — guard patch should still fix payment"
    echo "      Also paste src/lib/stripe-checkout.js in Base44 when you can"
  elif echo "$bundle" | grep -q 'openInWebView'; then
    echo "OK: App bundle uses openInWebView for Stripe"
  fi
fi

echo ""
echo "After Publish: force-quit app, reopen, try Pay again."
