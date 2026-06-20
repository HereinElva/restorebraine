#!/usr/bin/env bash
# Force fresh Capacitor web bundle into App.app on every Xcode build.
# Xcode blue folder references for public/ often skip updates on incremental builds.
set -uo pipefail

SRC_PUBLIC="${SRCROOT}/App/public"
DEST_PUBLIC="${CODESIGNING_FOLDER_PATH}/public"
STAMP="${SRCROOT}/App/BUILD_STAMP.txt"
CONFIG="${SRCROOT}/App/capacitor.config.json"

if [ ! -d "$SRC_PUBLIC" ]; then
  echo "error: ${SRC_PUBLIC} missing — run: bash scripts/mac-ios-native-rebuild.sh"
  exit 1
fi

rm -rf "$DEST_PUBLIC"
ditto "$SRC_PUBLIC" "$DEST_PUBLIC"

if [ -f "$STAMP" ]; then
  cp "$STAMP" "${CODESIGNING_FOLDER_PATH}/BUILD_STAMP.txt"
fi

if [ -f "$CONFIG" ]; then
  cp "$CONFIG" "${CODESIGNING_FOLDER_PATH}/capacitor.config.json"
fi

ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "${SRC_PUBLIC}/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//')
STAMP_LINE=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo 'unknown')
echo "Restorebraine: copied public/ -> App.app (${STAMP_LINE}, entry ${ENTRY:-?})"
