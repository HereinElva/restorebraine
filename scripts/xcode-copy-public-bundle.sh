#!/usr/bin/env bash
# Force fresh Capacitor web bundle into App.app on EVERY Xcode build.
# public/, BUILD_STAMP.txt, and capacitor.config.json are NOT in Copy Bundle Resources
# (only this script copies them — avoids stale blue-folder incremental copies).
set -euo pipefail

SRC_PUBLIC="${SRCROOT}/App/public"
DEST_APP="${CODESIGNING_FOLDER_PATH}"
DEST_PUBLIC="${DEST_APP}/public"
STAMP="${SRCROOT}/App/BUILD_STAMP.txt"
CONFIG="${SRCROOT}/App/capacitor.config.json"

if [ -z "${CODESIGNING_FOLDER_PATH:-}" ] || [ ! -d "${DEST_APP}" ]; then
  echo "error: CODESIGNING_FOLDER_PATH not ready — copy phase must run after Resources"
  exit 1
fi

if [ ! -d "$SRC_PUBLIC" ] || [ ! -f "${SRC_PUBLIC}/index.html" ]; then
  echo "error: ${SRC_PUBLIC}/index.html missing"
  echo "       Run: bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi

ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "${SRC_PUBLIC}/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//')
if [ -z "$ENTRY" ] || [ ! -f "${SRC_PUBLIC}/assets/${ENTRY}" ]; then
  echo "error: index.html entry ${ENTRY:-missing} not found in ${SRC_PUBLIC}/assets"
  echo "       Run: bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi

rm -rf "$DEST_PUBLIC"
ditto "$SRC_PUBLIC" "$DEST_PUBLIC"

[ -f "$STAMP" ] && cp "$STAMP" "${DEST_APP}/BUILD_STAMP.txt"
[ -f "$CONFIG" ] && cp "$CONFIG" "${DEST_APP}/capacitor.config.json"

MANIFEST="${DEST_APP}/DEPLOY_MANIFEST.txt"
{
  echo "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "build_stamp=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo unknown)"
  echo "entry=${ENTRY}"
  echo "src_public=${SRC_PUBLIC}"
} > "$MANIFEST"

# Prove copy landed (catches Xcode skipping stale folder references)
if [ ! -f "${DEST_PUBLIC}/assets/${ENTRY}" ]; then
  echo "error: copy failed — ${DEST_PUBLIC}/assets/${ENTRY} missing after ditto"
  exit 1
fi

STAMP_LINE=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo 'unknown')
echo "Restorebraine DEPLOY OK: public/ -> App.app"
echo "  BUILD_STAMP: ${STAMP_LINE}"
echo "  entry: ${ENTRY}"
