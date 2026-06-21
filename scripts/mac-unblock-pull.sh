#!/usr/bin/env bash
# Unblock git pull when build stamps (index.html, build-info.js, etc.) block merge.
# Usage: bash scripts/mac-unblock-pull.sh
#        bash scripts/mac-unblock-pull.sh && bash scripts/mac-ios-v4-deploy.sh --no-sync
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "=== Unblock pull — reset build stamps, sync to origin/$BRANCH ==="
echo "Current branch: $CURRENT"
echo ""
echo "If git pull failed with 'local changes would be overwritten', this fixes it."
echo "Do NOT run 'git pull' manually — use mac-ios-v4-deploy.sh instead."
echo ""

git fetch origin "$BRANCH"

# Force sync — checkout -B fails when index.html / build-info.js still dirty
git reset --hard "origin/$BRANCH"

# public/ is never restored from git (stale bundles cause no-change on device)
rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets

bash scripts/mac-ensure-development-team.sh

echo ""
echo "Synced to:"
git log --oneline -1
echo ""
echo "⚠️  ios/App/App/public/ was wiped (build output — not in git)."
echo ""
echo "TWO separate things update on iPhone:"
echo "  1. LOGIN / app UI  → rebuild web bundle:"
echo "       bash scripts/mac-capacitor-web-sync.sh"
echo "  2. LAUNCH SCREEN icon → requires Xcode Run (native assets, not in public/):"
echo "       open ios/App/App.xcworkspace → Clean Build Folder → Run (Cmd+R)"
echo ""
echo "Quick full path (DEV bundled login — NOT for App Store):"
echo "  bash scripts/mac-capacitor-web-sync.sh"
echo ""
echo "App Store / TestFlight (hosted Omega-style — login works):"
echo "  bash scripts/mac-appstore-deploy.sh"
