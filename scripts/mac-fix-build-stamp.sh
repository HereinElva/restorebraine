#!/usr/bin/env bash
# Recreate ios/App/App/BUILD_STAMP.txt for Xcode (file is gitignored, generated on build).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

STAMP_FILE="ios/App/App/BUILD_STAMP.txt"
mkdir -p "$(dirname "$STAMP_FILE")"

if [[ -f src/lib/build-info.js ]]; then
  BUILD_NUM="$(grep -E 'BUILD_NUMBER = [0-9]+' src/lib/build-info.js | grep -oE '[0-9]+' | head -1 || true)"
  LABEL="$(grep -E "NATIVE_BUILD_LABEL = '" src/lib/build-info.js | sed "s/.*NATIVE_BUILD_LABEL = '//;s/'.*//" || true)"
fi

if [[ -z "${LABEL:-}" && -n "${BUILD_NUM:-}" ]]; then
  LABEL="kbrown v4-core v${BUILD_NUM} · $(date '+%Y-%m-%d %H:%M')"
fi

if [[ -z "${LABEL:-}" ]]; then
  echo "ERROR: run node scripts/sync-build-numbers.mjs first (build-info.js missing)."
  exit 1
fi

printf '%s\n' "$LABEL" > "$STAMP_FILE"
echo "Wrote $STAMP_FILE"
echo "  $LABEL"
echo ""
echo "In Xcode: close BUILD_STAMP tab, click the file again (or Product → Clean Build Folder)."
