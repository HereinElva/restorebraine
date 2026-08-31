#!/usr/bin/env bash
# Recreate ios/App/App/BUILD_STAMP.txt for Xcode (file is gitignored, generated on build).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

STAMP_FILE="ios/App/App/BUILD_STAMP.txt"
mkdir -p "$(dirname "$STAMP_FILE")"

if [[ -f src/lib/build-info.js ]]; then
  LABEL="$(node -e "const m=require('./src/lib/build-info.js'); console.log(m.NATIVE_BUILD_LABEL || 'restorebraine');" 2>/dev/null || true)"
fi

if [[ -z "${LABEL:-}" ]]; then
  DEPLOY="$(grep -E 'DEPLOY_BUILD = [0-9]+' src/deploy-marker.js | grep -oE '[0-9]+' || echo '?')"
  LABEL="kbrown v4-core v${DEPLOY} · $(date '+%Y-%m-%d %H:%M')"
fi

printf '%s\n' "$LABEL" > "$STAMP_FILE"
echo "Wrote $STAMP_FILE"
echo "  $LABEL"
echo ""
echo "In Xcode: close BUILD_STAMP tab, click the file again (or Product → Clean Build Folder)."
