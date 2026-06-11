#!/usr/bin/env bash
# One-command fix when Xcode AppIcon 1024pt slot stays empty.
# Bypasses git merge conflicts on Contents.json by checking out icons from origin/main.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

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
git checkout origin/main -- "$ICON_DIR"

echo "==> Regenerating all icon PNGs + Contents.json"
npm run ios:icons
node scripts/verify-ios-icons.mjs

echo
echo "==> Verifying files on disk"
test -f "$ICON_DIR/appstore.png" || { echo "FAIL: appstore.png missing"; exit 1; }
test -f "$ICON_DIR/AppIcon-1024.png" || { echo "FAIL: AppIcon-1024.png missing"; exit 1; }
ls -la "$ICON_DIR/appstore.png" "$ICON_DIR/AppIcon-1024.png"

echo
echo "==> Contents.json 1024pt slot"
grep -B1 -A4 'ios-marketing' "$ICON_DIR/Contents.json"

echo
echo "==> Clearing Xcode DerivedData (stale asset cache)"
rm -rf ~/Library/Developer/Xcode/DerivedData

echo
echo "==> Opening icon folder in Finder (drag appstore.png into Xcode if slot is empty)"
open "$ROOT/$ICON_DIR"

echo "==> Opening Xcode workspace"
open "$ROOT/ios/App/App.xcworkspace"

cat <<'EOF'

=== Next steps in Xcode ===
1. Project Navigator → App → Assets.xcassets → AppIcon
2. Scroll to bottom: "App Store iOS 1024pt" slot
3. If empty: drag appstore.png from the Finder window into that slot
4. Product → Clean Build Folder → Archive → Upload (build 10)

If git pull was failing before, you do NOT need git pull — this script
already synced the icon folder from GitHub.

EOF
