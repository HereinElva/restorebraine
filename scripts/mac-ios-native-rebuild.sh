#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS native-local rebuild ==="
echo "Discarding auto-generated files (safe)..."
git checkout -- ios/App/App/BUILD_STAMP.txt src/lib/build-info.js src/lib/native-bundle-mode.js src/deploy-marker.js index.html 2>/dev/null || true

echo "Pulling $BRANCH ..."
git pull origin "$BRANCH"

echo "Building native-local bundle..."
npm run build:native-local

URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json || true)
echo ""
if [[ "$URL_COUNT" == "0" ]]; then
  echo "OK: native-local mode (no server.url)"
else
  echo "WARNING: server.url still set — app will load Base44 website, not native bundle"
  echo "Run: npm run build:native-local"
fi

echo ""
echo "Next: Xcode -> delete app -> Clean Build Folder -> Run"
echo "Launch from home screen icon, NOT Safari."
