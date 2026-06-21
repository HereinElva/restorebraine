#!/usr/bin/env bash
# Fix AppIcon for classic Xcode grid (iPhone/iPad sizes + App Store 1024pt at bottom).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
SPLASH_DIR="ios/App/App/Assets.xcassets/Splash.imageset"
FORCE=false

for arg in "$@"; do
  if [ "$arg" = "--force" ]; then
    FORCE=true
  fi
done

echo "=== Restorebraine App Icon Fix (Classic Grid) ==="
echo "Repo: $ROOT"
echo

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "WARNING: Xcode is still running."
  echo
  echo "Option A — quit Xcode properly:"
  echo "  1. Click the Xcode icon in the Dock"
  echo "  2. Press Cmd+Q (not just close the window)"
  echo "  3. Run this script again"
  echo
  echo "Option B — force quit Xcode from Terminal:"
  echo "  killall Xcode"
  echo "  bash scripts/mac-fix-app-icon.sh"
  echo
  if [ "$FORCE" != true ]; then
    echo "Option C — run anyway (Xcode may undo changes):"
    echo "  bash scripts/mac-fix-app-icon.sh --force"
    exit 1
  fi
  echo "Continuing with --force (close Xcode soon if it reopens)..."
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: not inside the restorebraine git repo."
  exit 1
fi

echo "==> Fetching origin/main"
git fetch origin main

echo "==> Resetting icon + splash assets from GitHub (fixes accidental Xcode drag-drop)"
git checkout origin/main -- \
  "$ICON_DIR" \
  "$SPLASH_DIR" \
  ios/App/App/Assets.xcassets/LaunchLogo.imageset \
  ios/App/App/Base.lproj/LaunchScreen.storyboard \
  scripts/generate-ios-app-icons.mjs \
  scripts/generate-ios-launch-screen.mjs \
  scripts/verify-ios-icons.mjs \
  ios/App/App/Info.plist \
  ios/App/App.xcodeproj/project.pbxproj

echo "==> Fetching official Restorebraine brain icon + regenerating all sizes"
npm run ios:icons
node scripts/verify-ios-icons.mjs

echo
echo "==> App Store icon file:"
ls -la "$ICON_DIR/AppIcon-1024.png"

echo
echo "==> Clearing Xcode cache"
rm -rf ~/Library/Developer/Xcode/DerivedData

echo
echo "==> Opening Finder + Xcode"
open "$ROOT/$ICON_DIR"
open "$ROOT/ios/App/App.xcworkspace"

cat <<'EOF'

=== In Xcode (classic grid) ===
1. App → Assets.xcassets → AppIcon
2. iPhone + iPad sizes should be filled (purple magnifying-glass)
3. Scroll to BOTTOM: "App Store iOS 1024pt"
4. If empty: drag AppIcon-1024.png from Finder into that slot
5. Product → Clean Build Folder → Archive → Upload build 13

You do NOT need to git push — GitHub already has the correct icons.
Do NOT drag images into Splash.imageset (that breaks the launch screen).

EOF
