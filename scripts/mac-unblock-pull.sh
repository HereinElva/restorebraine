#!/usr/bin/env bash
# Unblock git pull when cap-sync leaves modified/untracked files in ios/App/App/public/.
# Safe to run anytime — npm run build:native-local regenerates these files.
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Force-clean iOS public bundle (unblock pull) ==="
rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets
git clean -ffdx ios/App/App/public/ 2>/dev/null || true
bash scripts/mac-discard-build-files.sh 2>/dev/null || true
git checkout -f HEAD -- ios/App/App.xcodeproj/project.pbxproj 2>/dev/null \
  || git restore --staged --worktree ios/App/App.xcodeproj/project.pbxproj 2>/dev/null \
  || true

echo "Pulling origin/$BRANCH ..."
if ! git pull origin "$BRANCH"; then
  echo ""
  echo "Pull still blocked. Close Xcode, then run:"
  echo "  git checkout -f HEAD -- ios/App/App.xcodeproj/project.pbxproj"
  echo "  git pull origin $BRANCH"
  exit 1
fi

echo ""
echo "Pull OK. Next: bash scripts/mac-ios-native-rebuild.sh"
