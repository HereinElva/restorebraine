#!/usr/bin/env bash
# Xcode build phase wrapper — ensures node is on PATH for GUI builds.
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ICON="${ROOT}/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

echo "========================================="
echo "Restorebraine iOS bundle check"

if [ -f "${ROOT}/ios/App/App/BUILD_STAMP.txt" ]; then
  echo "BUILD_STAMP: $(cat "${ROOT}/ios/App/App/BUILD_STAMP.txt")"
else
  echo "warning: BUILD_STAMP.txt missing. Run bash scripts/mac-ios-native-rebuild.sh"
fi

if [ -f "$ICON" ]; then
  echo "AppIcon: AppIcon-1024.png OK ($(wc -c < "$ICON" | tr -d ' ') bytes)"
else
  echo "error: Missing App Store 1024pt icon — run: bash scripts/mac-fix-app-icon.sh"
  exit 1
fi

CONFIG="${ROOT}/ios/App/App/capacitor.config.json"
if [ -f "$CONFIG" ]; then
  if grep -q '\*.google.com' "$CONFIG" 2>/dev/null; then
    echo "capacitor.config.json: OAuth allowlist OK"
  elif ! grep -q '"url"' "$CONFIG" 2>/dev/null; then
    echo "capacitor.config.json: native-local mode (no server.url) OK"
  else
    echo "warning: capacitor.config.json may be outdated — run bash scripts/mac-ios-native-rebuild.sh"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "warning: node not in PATH — skipping JS bundle verify"
  echo "Run bash scripts/mac-ios-native-rebuild.sh from Terminal before archiving"
  echo "========================================="
  exit 0
fi

node "${ROOT}/scripts/xcode-verify-bundle.mjs"
