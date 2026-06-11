#!/usr/bin/env bash
# Fix AppIcon for classic Xcode grid (iPhone/iPad sizes + App Store 1024pt at bottom).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

echo "=== Restorebraine App Icon Fix (Classic Grid) ==="

if pgrep -x Xcode >/dev/null 2>&1; then
  echo "ERROR: Quit Xcode (Cmd+Q) first, then run this again."
  exit 1
fi

git fetch origin main
git checkout origin/main -- "$ICON_DIR" scripts/generate-ios-app-icons.mjs scripts/verify-ios-icons.mjs ios/App/App/Info.plist

npm run ios:icons
node scripts/verify-ios-icons.mjs

ls -la "$ICON_DIR/AppIcon-1024.png"
rm -rf ~/Library/Developer/Xcode/DerivedData

open "$ROOT/$ICON_DIR"
open "$ROOT/ios/App/App.xcworkspace"

cat <<'EOF'

=== In YOUR Xcode (classic grid — no Any/Dark/Tinted) ===
1. App → Assets.xcassets → AppIcon
2. You should see iPhone + iPad icon sizes (NOT "Any Appearance")
3. Scroll to the BOTTOM: "App Store iOS 1024pt" — drag AppIcon-1024.png into it
4. Product → Clean Build Folder → Archive → Upload build 13

EOF
