#!/bin/sh
# Xcode build phase — fail early on ghost-build / white-screen risks
set -eu

SRCROOT="${SRCROOT:-$(cd "$(dirname "$0")" && pwd)}"

BUILD_STAMP="${SRCROOT}/App/BUILD_STAMP.txt"
CONFIG="${SRCROOT}/App/capacitor.config.json"
PUBLIC="${SRCROOT}/App/public/index.html"
GHOST="${SRCROOT}/App/ghost-builds.txt"
APPSTORE_ICON="${SRCROOT}/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

echo "========================================="
echo "Restorebraine iOS bundle check"

if [ -f "$BUILD_STAMP" ]; then
  echo "BUILD_STAMP: $(cat "$BUILD_STAMP")"
else
  echo "warning: BUILD_STAMP.txt missing. Run npm run fix:no-change from repo root."
fi

if [ -f "$APPSTORE_ICON" ]; then
  echo "AppIcon: AppIcon-1024.png OK ($(wc -c < "$APPSTORE_ICON") bytes)"
else
  echo "error: Missing App Store 1024pt icon at AppIcon.appiconset/AppIcon-1024.png"
  echo "       Run from repo root: bash scripts/mac-fix-app-icon.sh"
  exit 1
fi

if [ -f "$CONFIG" ] && grep -q "restorebraine.base44.app" "$CONFIG"; then
  echo "MODE: HOSTED (loads live Base44 — ghost purge in AppDelegate)"
elif [ -f "$CONFIG" ]; then
  echo "MODE: BUNDLED (loads ios/public — experimental)"
else
  echo "warning: capacitor.config.json missing"
fi

if [ -f "$CONFIG" ] && grep -q "accounts.google.com" "$CONFIG"; then
  echo "capacitor.config.json: OAuth allowlist OK"
else
  echo "warning: Old capacitor.config.json. Run npm run fix:no-change from repo root."
fi

if [ -f "$PUBLIC" ] && grep -q crossorigin "$PUBLIC"; then
  echo "error: public/index.html has crossorigin — breaks capacitor:// (white screen)"
  echo "       Run: npm run build:native-local"
  exit 1
fi

ENTRY=""
if [ -f "$PUBLIC" ]; then
  ENTRY=$(grep -oE 'index-[^"]+\.js' "$PUBLIC" | head -1)
fi

if [ -n "$ENTRY" ] && [ -f "$GHOST" ]; then
  if grep -q "^+ ${ENTRY}" "$GHOST" || ! grep -qx "${ENTRY}" "$GHOST"; then
    echo "ghost-builds: ${ENTRY} allowed (not blocklisted)"
  else
    echo "error: Bundled entry ${ENTRY} is BLOCKlisted in ghost-builds.txt — ghost reload / white screen risk"
    echo "       Run: npm run ghosts:sync && npm run fix:no-change"
    exit 1
  fi
fi

echo "========================================="
