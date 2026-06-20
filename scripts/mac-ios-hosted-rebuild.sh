#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS HOSTED rebuild (loads live Base44) ==="
git checkout -- ios/App/App/BUILD_STAMP.txt src/lib/build-info.js src/lib/native-bundle-mode.js src/deploy-marker.js index.html 2>/dev/null || true
git pull origin "$BRANCH"

echo "Building hosted mode (restorebraine.base44.app)..."
node scripts/write-build-info.mjs
node scripts/use-local-native-bundle.mjs --hosted
npm run ios:icons
node scripts/sync-app-icon.mjs
vite build
node scripts/patch-native-purchases-podspec.mjs
npx cap sync ios
node scripts/verify-ios-sync.mjs
node scripts/verify-ios-icons.mjs

URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json || true)
echo ""
if [[ "$URL_COUNT" == "1" ]]; then
  echo "OK: hosted mode (server.url -> restorebraine.base44.app)"
else
  echo "WARNING: server.url missing — run: node scripts/use-local-native-bundle.mjs --hosted"
fi
echo ""
echo "Next: Xcode -> delete app -> Clean -> Run"
echo "You should go straight to gallery if already logged in on Base44."
