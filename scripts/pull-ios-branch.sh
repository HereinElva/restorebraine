#!/usr/bin/env bash
# Discard auto-generated build files that often block git pull, then pull the iOS fix branch.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"

cd "$(git rev-parse --show-toplevel)"

bash scripts/mac-discard-build-files.sh

echo "Pulling origin/$BRANCH ..."
if ! git pull origin "$BRANCH"; then
  echo ""
  echo "Pull blocked — running deeper clean and retrying once..."
  bash scripts/mac-discard-build-files.sh
  git pull origin "$BRANCH"
fi

echo ""
echo "Done. Pick ONE path:"
echo ""
echo "  A) Native app (bundled code, no Base44 URL bar) — recommended for testing:"
echo "     npm run build:native-local"
echo "     (do NOT run cap:hosted after)"
echo ""
echo "  B) Hosted mode (loads live Base44 — needs Publish in Base44 editor):"
echo "     npm run cap:hosted && npm run build"
echo ""
echo "Then Xcode: delete app → Clean Build Folder → Run"
echo "Open the Restorebraine icon from Xcode — NOT Safari."
