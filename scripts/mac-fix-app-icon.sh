#!/usr/bin/env bash
# One-command fix when Xcode AppIcon 1024pt slot stays empty.
# Bypasses git merge conflicts on Contents.json by checking out icons from origin/main.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
UNIVERSAL_ICON="$ICON_DIR/AppIcon-512@2x.png"

echo "=== Restorebraine App Icon Fix ==="
echo "Repo: $ROOT"
echo

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "ERROR: Xcode is still running."
  echo "Quit Xcode completely (Cmd+Q), then run this script again:"
  echo "  bash scripts/mac-fix-app-icon.sh"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not inside the restorebraine git repo."
  exit 1
fi

echo "==> Fetching latest from origin/main"
git fetch origin main

echo "==> Resetting AppIcon.appiconset from origin/main (ignores local Xcode edits)"
git checkout origin/main -- "$ICON_DIR" scripts/generate-ios-app-icons.mjs scripts/verify-ios-icons.mjs scripts/mac-fix-app-icon.sh 2>/dev/null || true
git checkout origin/main -- scripts/generate-ios-app-icons.mjs scripts/verify-ios-icons.mjs 2>/dev/null || true

echo "==> Regenerating Xcode 16 universal icon (Any + Dark + Tinted)"
npm run ios:icons
node scripts/verify-ios-icons.mjs

echo
echo "==> Verifying files on disk"
test -f "$UNIVERSAL_ICON" || { echo "FAIL: AppIcon-512@2x.png missing"; exit 1; }
ls -la "$UNIVERSAL_ICON"

echo
echo "==> Contents.json (should show 3 universal 1024 entries)"
cat "$ICON_DIR/Contents.json"

echo
echo "==> Clearing Xcode DerivedData (stale asset cache)"
rm -rf ~/Library/Developer/Xcode/DerivedData

echo
echo "==> Opening icon folder in Finder"
open "$ROOT/$ICON_DIR"

echo "==> Opening Xcode workspace"
open "$ROOT/ios/App/App.xcworkspace"

cat <<'EOF'

=== In Xcode (Xcode 15/16) ===
1. Project Navigator → App → Assets.xcassets → AppIcon
2. You should see THREE 1024 slots: Any Appearance, Dark, Tinted
3. All three should show the purple magnifying-glass icon
4. If Any Appearance is empty: drag AppIcon-512@2x.png from Finder into it
5. Product → Clean Build Folder → Archive → Upload

Do NOT use the old multi-size grid — Xcode 16 uses universal icons only.

EOF
