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

BRANCH="${1:-main}"

sync_to_origin() {
  echo "==> Fetching origin/$BRANCH"
  git fetch origin "$BRANCH"

  echo "==> Syncing repo to origin/$BRANCH"
  echo "    (Replaces local changes to Podfile, package-lock.json, AppIcons, etc.)"
  git reset --hard "origin/$BRANCH"
  # Only clean generated web bundle — never wipe Assets.xcassets app icons.
  git clean -fd -- ios/App/App/public/ 2>/dev/null || true
}

sync_to_origin

echo "==> Verify GitHub v87 baseline (5762b16 UI + f1b2505 tip)"
node scripts/verify-v87-baseline.mjs

if [[ ! -f src/lib/native-media-input.js ]]; then
  echo
  echo "ERROR: src/lib/native-media-input.js is missing on branch '$BRANCH'."
  echo "       For the current iOS + upload build, run:"
  echo "       bash scripts/mac-ios-setup.sh cursor/apple-privacy-plist-bacf"
  exit 1
fi

echo "==> Installing npm dependencies (required after every pull)"
npm install

echo "==> Fetching official app icon + regenerating iOS sizes"
node scripts/fetch-official-app-icon.mjs
node scripts/generate-ios-app-icons.mjs
node scripts/verify-ios-icons.mjs

echo "==> Building web app + syncing iOS bundle (hosted app — native session + OAuth)"
node scripts/use-local-native-bundle.mjs --hosted
npm run ios:prepare

STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt)"
echo "Build stamp: $STAMP"

if ! grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
  echo
  echo "ERROR: ios/App/App/capacitor.config.json is missing server.url."
  echo "       Native app must load https://restorebraine.base44.app for OAuth + session."
  echo "       Run: npm run ios:prepare"
  exit 1
fi

echo "==> server.url (native shell loads hosted Restorebraine — OAuth persists across launches):"
grep -E '"url"' ios/App/App/capacitor.config.json || true

echo "==> Info.plist app icon binding:"
grep -A1 CFBundleIconName ios/App/App/Info.plist || { echo "ERROR: CFBundleIconName missing from Info.plist"; exit 1; }

echo "==> Info.plist privacy usage descriptions (App Store 5.1.1):"
bash scripts/verify-ios-privacy-plist.sh

echo "==> App icon files (classic grid + App Store 1024pt):"
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
node scripts/verify-ios-icons.mjs

echo "==> Installing CocoaPods"
cd ios/App
pod install

echo "==> Done. Replace iPhone app before opening Xcode..."
bash scripts/prompt-replace-iphone-app.sh --before-xcode

echo
echo "==> Opening Xcode workspace..."
open App.xcworkspace

echo
echo "In Xcode:"
echo "  1. Open App.xcworkspace (not .xcodeproj)"
echo "  2. In Project Navigator → App → Assets.xcassets → AppIcon — icons should appear"
echo "  3. Product → Clean Build Folder → Run (fresh install after app delete above)"
echo "Expected build stamp: $STAMP"
echo
echo "Branch synced: $BRANCH (use cursor/apple-privacy-plist-bacf for latest iOS build)"
echo
echo "Native model: WebView loads restorebraine.base44.app — sign in once via Google OAuth,"
echo "session persists in the app. Dev-only bundled UI: npm run build:native-local"
echo
echo "If home screen icon is still blank after install:"
echo "  1. Delete app from iPhone"
echo "  2. Restart iPhone (iOS caches icons)"
echo "  3. Clean Build Folder in Xcode → Run again"
