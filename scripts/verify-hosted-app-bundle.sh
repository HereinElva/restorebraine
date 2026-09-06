#!/usr/bin/env bash
# Verify App.app is in HOSTED mode — WebView loads restorebraine.base44.app (same as web).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

REPO_CONFIG="ios/App/App/capacitor.config.json"
REPO_URL=$(grep -o '"url": *"[^"]*"' "$REPO_CONFIG" 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)

find_deployed_app() {
  local best="" best_mtime=0 candidate mtime
  while IFS= read -r candidate; do
    case "$candidate" in
      *Index.noindex*) continue ;;
      *Build/Intermediates*) continue ;;
    esac
    [ -f "$candidate/capacitor.config.json" ] || continue
    mtime=$(stat -f '%m' "$candidate" 2>/dev/null || echo 0)
    if [ "$mtime" -gt "$best_mtime" ]; then
      best_mtime=$mtime
      best=$candidate
    fi
  done < <(
    find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' -print 2>/dev/null
  )
  echo "$best"
}

echo "=== Verify HOSTED App.app (native = live web app) ==="
echo "Repo server.url: ${REPO_URL}"
echo ""

if [[ "$REPO_URL" != *"restorebraine.base44.app"* ]]; then
  echo "FAIL: Repo not in hosted mode — run: bash scripts/mac-complete-rebuild.sh"
  echo "      (or: bash scripts/mac-xcode-full-replace.sh --hosted)"
  exit 1
fi

APP=$(find_deployed_app)
if [ -z "$APP" ]; then
  echo "FAIL: No App.app — run Xcode Run once, then re-run this script"
  exit 1
fi

APP_URL=$(grep -o '"url": *"[^"]*"' "$APP/capacitor.config.json" 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
echo "App:  $APP"
echo "App server.url: $APP_URL"
echo ""

if [[ "$APP_URL" != *"restorebraine.base44.app"* ]]; then
  echo "FAIL: App.app missing hosted server.url — run: bash scripts/mac-copy-public-into-appapp.sh"
  exit 1
fi

echo "OK: Native app will load the LIVE website (same login + OAuth as web browser)"
echo "    Open app → should show restorebraine.base44.app content, NOT capacitor://localhost"
