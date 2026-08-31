#!/usr/bin/env bash
# Rebuild App bundle on Base44 with fixed Stripe checkout (paste 3 files, Publish once).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FILES=(
  "src/lib/stripe-checkout.js"
  "src/components/upload/PaymentModal.jsx"
  "src/main.jsx"
)

echo "=== Base44 Stripe bundle fix (3 files) ==="
echo "This rebuilds the App JS bundle so payment uses openInWebView directly."
echo ""

for f in "${FILES[@]}"; do
  echo "---"
  echo "Next: $f"
  pbcopy < "$f"
  echo "  Copied to clipboard."
  echo "  Base44 → $f → Select All → Paste → SAVE"
  read -r -p "  Press Enter when saved..."
done

echo ""
echo "Click PUBLISH once in Base44. Wait until done."
read -r -p "Press Enter after Publish..."
echo ""

HTML=$(curl -sL --max-time 15 "https://restorebraine.base44.app")
APP=$(echo "$HTML" | grep -oE 'assets/App-[A-Za-z0-9_-]+\.js' | head -1 || true)
echo "App bundle: ${APP:-unknown}"
if [[ -n "$APP" ]]; then
  BUNDLE=$(curl -sL --max-time 15 "https://restorebraine.base44.app/$APP")
  if echo "$BUNDLE" | grep -q 'openInSystemBrowser||'; then
    echo "WARN: bundle still prefers openInSystemBrowser — confirm all 3 files saved + Publish"
  elif echo "$BUNDLE" | grep -q 'openInWebView'; then
    echo "OK: bundle uses openInWebView for Stripe"
  fi
fi
