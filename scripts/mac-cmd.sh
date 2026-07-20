#!/usr/bin/env bash
# Run npm scripts from restorebraine repo — works even if you are in ~ (home).
# Usage: bash /Users/ari/restorebraine/scripts/mac-cmd.sh diagnose:all
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CMD="${1:-help}"
if [[ "$CMD" == "pull" ]]; then
  echo "==> cd $ROOT"
  git pull origin cursor/apple-privacy-plist-bacf
  echo ""
  npm run diagnose:all
  exit $?
fi
if [[ "$CMD" == "help" || "$CMD" == "-h" ]]; then
  echo "Restorebraine repo: $ROOT"
  echo ""
  echo "Usage: bash $ROOT/scripts/mac-cmd.sh <npm-script>"
  echo ""
  echo "Examples:"
  echo "  bash $ROOT/scripts/mac-cmd.sh nuke:v87"
  echo "  bash $ROOT/scripts/mac-cmd.sh base44:nuke-list"
  echo "  bash $ROOT/scripts/mac-cmd.sh diagnose:all"
  echo "  bash $ROOT/scripts/mac-cmd.sh gate:pre-update"
  echo "  bash $ROOT/scripts/mac-cmd.sh pull   # git pull + diagnose:all"
  echo "  bash $ROOT/scripts/mac-cmd.sh reset:v87-all"
  exit 0
fi
echo "==> cd $ROOT"
echo "==> npm run $CMD"
echo ""
npm run "$CMD"
