#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS HOSTED rebuild (loads live Base44) ==="
bash scripts/mac-discard-build-files.sh

echo "Pulling $BRANCH ..."
if ! git pull origin "$BRANCH"; then
  echo ""
  echo "Pull blocked — running deeper clean and retrying once..."
  bash scripts/mac-discard-build-files.sh
  git pull origin "$BRANCH"
fi

echo "Building hosted mode (restorebraine.base44.app)..."
npm run build

URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json || true)
echo ""
if [[ "$URL_COUNT" == "1" ]]; then
  echo "OK: hosted mode (server.url -> restorebraine.base44.app)"
else
  echo "WARNING: server.url missing — expected hosted mode"
fi
echo ""
echo "Next: Xcode -> delete app -> Clean Build Folder -> Run"
echo "You should go straight to gallery if already logged in on Base44."
