#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$ROOT/ios/App/App/Info.plist"

if [[ ! -f "$PLIST" ]]; then
  echo "ERROR: Missing $PLIST"
  exit 1
fi

require_key() {
  local key="$1"
  local min_len="${2:-80}"
  if ! /usr/libexec/PlistBuddy -c "Print :$key" "$PLIST" >/dev/null 2>&1; then
    echo "ERROR: Info.plist missing required key: $key"
    exit 1
  fi
  local value
  value="$(/usr/libexec/PlistBuddy -c "Print :$key" "$PLIST" 2>/dev/null || true)"
  if [[ ${#value} -lt $min_len ]]; then
    echo "ERROR: $key is too short for App Store review (${#value} chars)."
    exit 1
  fi
  case "$value" in
    *"needs access"*|*"Allow access"*|*"This app needs"*)
      echo "ERROR: $key looks too vague for Apple Guideline 5.1.1(ii)."
      exit 1
      ;;
  esac
  echo "OK  $key (${#value} chars)"
}

echo "==> Verifying iOS privacy usage descriptions"
require_key NSCameraUsageDescription 120
require_key NSPhotoLibraryUsageDescription 120
require_key NSPhotoLibraryAddUsageDescription 80
echo "Privacy plist checks passed."
