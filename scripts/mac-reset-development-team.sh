#!/usr/bin/env bash
# Restore DEVELOPMENT_TEAM in project.pbxproj from git (fixes accidental YOUR_TEAM_ID paste).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEFAULT_TEAM="V378L53XQP"
PBX="ios/App/App.xcodeproj/project.pbxproj"

echo "=== Reset DEVELOPMENT_TEAM to $DEFAULT_TEAM ==="
git checkout -- "$PBX"
echo "OK: restored $PBX from git (DEVELOPMENT_TEAM=$DEFAULT_TEAM)"
echo ""
echo "Next: sign into Xcode (required before any install):"
echo "  bash scripts/mac-open-signing-fix.sh"
