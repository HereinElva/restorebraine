#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS native-local rebuild ==="
bash scripts/mac-discard-build-files.sh

echo "Pulling $BRANCH ..."
if ! git pull origin "$BRANCH"; then
  echo ""
  echo "Pull blocked — running deeper clean and retrying once..."
  bash scripts/mac-discard-build-files.sh
  git pull origin "$BRANCH"
fi

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
echo "=== VERIFY on device ==="
echo "Look for purple badge bottom-left: v95 · native-local"
echo "Login screen shows build label (build v4 bundled shell restored)"
echo ""
echo "Next: Xcode -> delete app -> Clean Build Folder -> Run"
echo "Native-local = bundled app shell (no Base44 URL bar). Gallery + Back button fixes included."
echo "For App Store hosted mode instead: bash scripts/mac-ios-hosted-rebuild.sh"
