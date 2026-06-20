#!/usr/bin/env bash
# One command to sync to latest branch and rebuild native-local (avoids zsh paste issues).
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine: pull latest and rebuild ==="
git fetch origin "$BRANCH"
git checkout -f HEAD -- ios/App/App.xcodeproj/project.pbxproj 2>/dev/null || true
git pull origin "$BRANCH"
echo ""
echo "Latest commit:"
git log --oneline -1
echo ""

bash scripts/mac-ios-native-rebuild.sh "$BRANCH"
