#!/usr/bin/env bash
# Discard auto-generated files that block git pull (safe — npm run build regenerates them).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git checkout -- \
  ios/App/App/BUILD_STAMP.txt \
  src/lib/build-info.js \
  src/lib/native-bundle-mode.js \
  src/deploy-marker.js \
  index.html \
  capacitor.config.json \
  ios/App/App/capacitor.config.json \
  2>/dev/null || true
echo "Discarded local build/config stamp files."
