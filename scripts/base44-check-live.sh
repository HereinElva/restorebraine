#!/usr/bin/env bash
set -euo pipefail
echo "Checking live Base44 site..."
html=$(curl -sL https://restorebraine.base44.app)
deploy=$(echo "$html" | grep -o 'name="restorebraine-deploy" content="v[0-9]*"' | grep -o 'v[0-9]*' || echo "not found")
deploy2=$(echo "$html" | grep -o 'content="v[0-9]*" name="restorebraine-deploy"' | grep -o 'v[0-9]*' || true)
bundle=$(echo "$html" | grep -oE 'assets/index-[^"]+\.js' | head -1 || echo "not found")
local_deploy=$(grep -o 'DEPLOY_BUILD = [0-9]*' src/deploy-marker.js 2>/dev/null | grep -o '[0-9]*' || echo "?")

echo ""
echo "Live site:  restorebraine.base44.app"
echo "  Deploy:   ${deploy:-$deploy2}"
echo "  Bundle:   ${bundle}"
echo "Local repo: deploy-marker v${local_deploy}"
echo ""

if [[ "${deploy:-$deploy2}" == "v${local_deploy}" ]]; then
  echo "OK: Live matches local v${local_deploy}"
else
  echo "NOT PUBLISHED YET: Live is ${deploy:-$deploy2} but local is v${local_deploy}"
  echo ""
  echo "Fix: Open Base44 Code editor in browser -> paste all 25 files -> click Publish"
  echo "Then re-run: bash scripts/base44-check-live.sh"
fi
