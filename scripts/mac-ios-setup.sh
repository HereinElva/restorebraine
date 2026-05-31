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
  # Only clean generated web bundle — never wipe Assets.xcassets app icons.
  git clean -fd -- ios/App/App/public/ 2>/dev/null || true
}

sync_to_origin

echo "==> Installing npm dependencies (required after every pull)"
npm install

echo "==> Regenerating iOS app icons"
node scripts/generate-ios-app-icons.mjs
node scripts/verify-ios-icons.mjs

echo "==> Building web app + syncing iOS bundle"
npm run ios:prepare

STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt)"
echo "Build stamp: $STAMP"

if ! grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
  echo
  echo "ERROR: ios/App/App/capacitor.config.json is missing server.url."
  echo "       Native app must load the hosted Restorebraine site. Run: npm run build"
  exit 1
fi

echo "==> server.url (must point at hosted Restorebraine app):"
grep -E '"url"' ios/App/App/capacitor.config.json || true

echo "==> Info.plist app icon binding:"
grep -A1 CFBundleIconName ios/App/App/Info.plist || { echo "ERROR: CFBundleIconName missing from Info.plist"; exit 1; }

echo "==> App icon files:"
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-60@3x.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png

echo "==> Installing CocoaPods"
cd ios/App
pod install

echo
echo "==> Done. Opening Xcode workspace..."
open App.xcworkspace

echo
echo "In Xcode:"
echo "  1. Open App.xcworkspace (not .xcodeproj)"
echo "  2. In Project Navigator → App → Assets.xcassets → AppIcon — icons should appear"
echo "  3. Delete app from iPhone → Product → Clean Build Folder → Run"
echo "Expected build stamp: $STAMP"
