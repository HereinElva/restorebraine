#!/usr/bin/env bash
# Print short Base44 publish checklist (paths only — no code).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
OUT="base44-publish-checklist-v${DEPLOY}.txt"

exec bash scripts/base44-publish-wizard.sh --list | tee "$OUT"
