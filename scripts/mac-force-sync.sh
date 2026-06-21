#!/usr/bin/env bash
# Force sync to origin branch — discards ALL local changes (build artifacts block pulls).
#
# DEFAULT: cursor/fix-native-localhost-oauth-bacf (v4-core, v106+)
# NOT cursor/fix-native-xcode-coding-bacf (old v60 — missing deploy scripts)
#
# Usage: bash scripts/mac-force-sync.sh
#    or: bash scripts/mac-force-sync.sh cursor/fix-native-localhost-oauth-bacf
# Recover from wrong branch: bash scripts/mac-recover-v4.sh
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

if [ "$BRANCH" = "cursor/fix-native-xcode-coding-bacf" ]; then
  echo "ERROR: cursor/fix-native-xcode-coding-bacf is the OLD v60 branch (no v4 deploy scripts)."
  echo "Use: bash scripts/mac-recover-v4.sh"
  echo " or: bash scripts/mac-force-sync.sh cursor/fix-native-localhost-oauth-bacf"
  exit 1
fi

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "=== Force sync to origin/$BRANCH ==="
echo "Current branch: $CURRENT -> $BRANCH"
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
