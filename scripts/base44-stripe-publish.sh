#!/usr/bin/env bash
# Stripe payment fix — paste 2 files in Base44, Publish once.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

echo "=== Base44 Stripe publish (v${DEPLOY}) ==="
echo ""
echo "Step 1: index.html (guard is INLINE — no separate public file needed)"
pbcopy < index.html
echo "  Copied. Base44 → index.html → Select All → Paste → SAVE"
read -r -p "  Press Enter when saved..."
echo ""
echo "Step 2: src/deploy-marker.js"
pbcopy < src/deploy-marker.js
echo "  Copied. Base44 → src/deploy-marker.js → Select All → Paste → SAVE"
read -r -p "  Press Enter when saved..."
echo ""
echo "Step 3: Click PUBLISH once in Base44. Wait until it finishes."
read -r -p "  Press Enter after Publish..."
echo ""
bash scripts/verify-stripe-live.sh
