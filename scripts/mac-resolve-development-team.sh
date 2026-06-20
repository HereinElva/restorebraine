#!/usr/bin/env bash
# Resolve DEVELOPMENT_TEAM for CLI xcodebuild (works even if Xcode UI never opened).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PBX="ios/App/App.xcodeproj/project.pbxproj"

if [ -n "${RESTOREBRAINE_DEVELOPMENT_TEAM:-}" ]; then
  echo "$RESTOREBRAINE_DEVELOPMENT_TEAM"
  exit 0
fi

if [ -f "$PBX" ]; then
  TEAM=$(grep 'DEVELOPMENT_TEAM = ' "$PBX" | head -1 | sed 's/.*= //;s/;//;s/ //g' || true)
  if [ -n "$TEAM" ]; then
    echo "$TEAM"
    exit 0
  fi
fi

# Default: Ariel Layugan team from successful v148 device install
echo "V378L53XQP"
