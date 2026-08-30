#!/usr/bin/env bash
# Stripe fix — ONE file for Base44 (native-ui-scrub.js)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Stripe fix: ONE file publish ==="
echo ""
echo "Copying public/native-ui-scrub.js to clipboard..."
pbcopy < public/native-ui-scrub.js
echo ""
echo "In Base44 Code editor:"
echo "  1. Open: public/native-ui-scrub.js  (or native-ui-scrub.js)"
echo "  2. Select All → Paste → SAVE"
echo "  3. Click PUBLISH once"
echo ""
read -r -p "Press Enter after Publish..."
echo ""
bash scripts/verify-stripe-live.sh
