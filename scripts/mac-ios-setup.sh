#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Restorebraine iOS setup"
echo "    Repo: $ROOT"
echo

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside the restorebraine git repo."
  exit 1
fi

BRANCH="${1:-cursor/fix-native-xcode-coding-bacf}"

sync_to_origin() {
  echo "==> Fetching origin/$BRANCH"
  git fetch origin "$BRANCH"

  echo "==> Syncing repo to origin/$BRANCH"
  echo "    (Replaces local changes to Podfile, package-lock.json, AppIcons, etc.)"
  git reset --hard "origin/$BRANCH"
  git clean -fd
}

sync_to_origin

echo "==> Installing npm dependencies (required after every pull)"
npm install

node scripts/generate-ios-app-icons.mjs

echo "==> Building web app + syncing iOS bundle"
npm run ios:prepare

STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt)"
echo "Build stamp: $STAMP"

if grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
  echo
  echo "ERROR: ios/App/App/capacitor.config.json still has server.url."
  echo "       The native app will load the wrong Base44 login page until this is removed."
  echo "       Run: npm run build"
  exit 1
fi

if ! echo "$STAMP" | grep -Eq 'kbrown native v(4[89]|[5-9][0-9]|[1-9][0-9]{2,})'; then
  echo
  echo "WARNING: BUILD_STAMP looks old ($STAMP)."
  echo "         Expected v49 or newer."
fi

echo "==> capacitor.config.json (must NOT contain server.url):"
grep -n 'url' ios/App/App/capacitor.config.json || echo "  (no url key — correct)"

echo "==> Installing CocoaPods"
cd ios/App
pod install

echo
echo "==> Done. Opening Xcode workspace..."
open App.xcworkspace

echo
echo "In Xcode: delete app from iPhone → Product → Clean Build Folder → Run"
echo "Expected build stamp after install: $STAMP"
echo
echo "Verify on Mac:"
echo "  cat ios/App/App/BUILD_STAMP.txt"
echo "  grep url ios/App/App/capacitor.config.json   # must NOT show restorebraine.base44.app url"
