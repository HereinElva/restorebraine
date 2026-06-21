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

if [ -d "$DEST_PUBLIC" ]; then
  OLD_COUNT=$(find "$DEST_PUBLIC" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "FULL REPLACE: removing ${DEST_PUBLIC} (${OLD_COUNT} old files)"
else
  echo "FULL REPLACE: no existing ${DEST_PUBLIC}"
fi

if [ ! -d "$SRC_PUBLIC" ] || [ ! -f "${SRC_PUBLIC}/index.html" ]; then
  echo ""
  echo "████████████████████████████████████████████████████████████████"
  echo "██  ERROR: ios/App/App/public/index.html is MISSING            ██"
  echo "██  Xcode cannot install new UI until you build the bundle.    ██"
  echo "██  In Terminal on your Mac, run:                              ██"
  echo "██    cd ~/restorebraine                                       ██"
  echo "██    bash build-iphone.sh --no-git                            ██"
  echo "████████████████████████████████████████████████████████████████"
  echo ""
  echo "error: ${SRC_PUBLIC}/index.html missing"
  echo "       Run: bash build-iphone.sh --no-git"
  exit 1
fi

ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "${SRC_PUBLIC}/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//')
if [ -z "$ENTRY" ] || [ ! -f "${SRC_PUBLIC}/assets/${ENTRY}" ]; then
  echo "error: index.html entry ${ENTRY:-missing} not found in ${SRC_PUBLIC}/assets"
  echo "       Run: bash scripts/mac-xcode-full-replace.sh --hosted"
  exit 1
fi

rm -rf "$DEST_PUBLIC"
ditto "$SRC_PUBLIC" "$DEST_PUBLIC"
NEW_COUNT=$(find "$DEST_PUBLIC" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "COMPLETE APP REPLACE: entire public/ tree replaced in App.app"
echo "FULL REPLACE: copied ${NEW_COUNT} files into App.app/public"

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

if [ ! -f "${SRC_PUBLIC}/login-logo.png" ]; then
  echo "warning: ${SRC_PUBLIC}/login-logo.png missing — login card may show brain emoji"
  echo "         Run: bash scripts/mac-xcode-full-replace.sh --hosted"
fi
if [ ! -f "${SRC_PUBLIC}/AppIcon.png" ]; then
  echo "warning: ${SRC_PUBLIC}/AppIcon.png missing"
  echo "         Run: bash scripts/mac-xcode-full-replace.sh --hosted"
fi

STAMP_LINE=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo 'unknown')
echo ""
echo "████████████████████████████████████████████████████████████████"
echo "██  Restorebraine DEPLOY OK: public/ -> App.app                  ██"
echo "██  BUILD_STAMP: ${STAMP_LINE}"
echo "██  entry: ${ENTRY}"
echo "██  files: ${NEW_COUNT}"
echo "████████████████████████████████████████████████████████████████"
echo ""
echo "Restorebraine DEPLOY OK: public/ -> App.app"
echo "  dest: ${DEST_APP}"
echo "  BUILD_STAMP: ${STAMP_LINE}"
echo "  entry: ${ENTRY}"
