#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -o 'DEPLOY_BUILD = [0-9]*' src/deploy-marker.js | grep -o '[0-9]*')

for part in 1 2 3; do
  f="base44-publish-v${DEPLOY}-part${part}.txt"
  if [[ -f "$f" ]]; then
    open "$f" 2>/dev/null || echo "Open this file manually: $f"
  fi
done

echo ""
echo "Opened publish pack parts in TextEdit."
echo "For each block: find BASE44 PATH line, paste code below divider into Base44 editor."
echo "After all 25 files saved -> click Publish once."
