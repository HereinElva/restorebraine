#!/usr/bin/env bash
# Force sync to origin branch — discards ALL local changes (build artifacts block pulls).
# Usage: bash scripts/mac-force-sync.sh
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Force sync to origin/$BRANCH ==="
git fetch origin "$BRANCH"
rm -rf ios/App/App/public
bash scripts/mac-discard-build-files.sh 2>/dev/null || true
git reset --hard "origin/$BRANCH"
git clean -fdx --exclude=ios/App/App/Assets.xcassets/AppIcon.appiconset/ 2>/dev/null || git clean -fd

echo ""
git log --oneline -1
echo ""
if grep -q 'find_deployed_app' scripts/verify-xcode-app-bundle.sh 2>/dev/null; then
  echo "verify-xcode-app-bundle.sh: updated (ignores Index.noindex)"
else
  echo "WARNING: verify script still looks outdated — check git log"
fi
echo ""
echo "Synced. Next:"
echo "  bash scripts/mac-ios-v4-rebuild.sh"
echo "  Xcode Run (Cmd+R) to iPhone"
echo "  bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "Diagnose anytime: bash scripts/mac-doctor.sh"
