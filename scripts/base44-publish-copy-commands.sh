#!/usr/bin/env bash
# Base44 publish — points to the interactive wizard (easier than giant txt file).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Base44 Publish v${DEPLOY} — use the wizard (recommended)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  bash scripts/base44-publish-wizard.sh"
echo ""
echo "The wizard copies ONE file at a time. You paste into Base44, Save, Enter."
echo "Do NOT open base44-publish-v${DEPLOY}.txt — it is too long."
echo ""
echo "Guide: docs/BASE44-PUBLISH.md"
echo ""
echo "Checklist only:"
echo "  bash scripts/base44-publish-wizard.sh --list"
echo ""
read -r -p "Start wizard now? (y/N) " GO
if [[ "$GO" =~ ^[Yy]$ ]]; then
  exec bash scripts/base44-publish-wizard.sh
fi
