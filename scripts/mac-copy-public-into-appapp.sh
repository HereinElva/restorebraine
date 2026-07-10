#!/usr/bin/env bash
# Copy ios/App/App/public/ into DerivedData App.app — same as Xcode "Restorebraine DEPLOY OK" phase.
# Use when npm build updated ios/public but Xcode has not Run since.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SRC_PUBLIC="ios/App/App/public"
STAMP="ios/App/App/BUILD_STAMP.txt"
CONFIG="ios/App/App/capacitor.config.json"

find_deployed_app() {
  local best="" best_mtime=0 candidate mtime
  while IFS= read -r candidate; do
    case "$candidate" in
      *Index.noindex*) continue ;;
      *Build/Intermediates*) continue ;;
    esac
    [ -f "$candidate/public/index.html" ] || continue
    mtime=$(stat -f '%m' "$candidate" 2>/dev/null || stat -c '%Y' "$candidate" 2>/dev/null || echo 0)
    if [ "$mtime" -gt "$best_mtime" ]; then
      best_mtime=$mtime
      best=$candidate
    fi
  done < <(
    find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' -print 2>/dev/null
  )
  echo "$best"
}

DEST_APP="${1:-$(find_deployed_app)}"

if [ -z "$DEST_APP" ] || [ ! -d "$DEST_APP" ]; then
  echo "FAIL: No Debug-iphoneos App.app in DerivedData."
  echo "  Run once in Xcode: Product → Run (Cmd+R) with iPhone selected"
  echo "  Or: bash scripts/mac-xcode-build-device.sh"
  exit 1
fi

if [ ! -f "$SRC_PUBLIC/index.html" ]; then
  echo "FAIL: $SRC_PUBLIC/index.html missing — run: npm run build:native-local"
  exit 1
fi

ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "$SRC_PUBLIC/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//')
if [ -z "$ENTRY" ] || [ ! -f "$SRC_PUBLIC/assets/$ENTRY" ]; then
  echo "FAIL: entry JS $ENTRY missing in $SRC_PUBLIC/assets"
  exit 1
fi

DEST_PUBLIC="$DEST_APP/public"
rm -rf "$DEST_PUBLIC"
ditto "$SRC_PUBLIC" "$DEST_PUBLIC"

[ -f "$STAMP" ] && cp "$STAMP" "$DEST_APP/BUILD_STAMP.txt"
[ -f "$CONFIG" ] && cp "$CONFIG" "$DEST_APP/capacitor.config.json"

{
  echo "deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "build_stamp=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo unknown)"
  echo "entry=${ENTRY}"
  echo "src_public=$(cd "$(dirname "$SRC_PUBLIC")" && pwd)/public"
} > "$DEST_APP/DEPLOY_MANIFEST.txt"

if [ ! -f "$DEST_PUBLIC/assets/$ENTRY" ]; then
  echo "FAIL: copy failed — $DEST_PUBLIC/assets/$ENTRY missing"
  exit 1
fi

STAMP_LINE=$(tr -d '\n' < "$STAMP" 2>/dev/null || echo unknown)
echo "Restorebraine DEPLOY OK: public/ -> App.app"
echo "  dest: $DEST_APP"
echo "  BUILD_STAMP: $STAMP_LINE"
echo "  entry: $ENTRY"
