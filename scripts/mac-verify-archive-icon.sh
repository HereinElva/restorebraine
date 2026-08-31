#!/usr/bin/env bash
# Verify a built .xcarchive or .ipa contains the 1024 App Store icon in Assets.car
set -euo pipefail

ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ]; then
  echo "Usage: bash scripts/mac-verify-archive-icon.sh /path/to/App.xcarchive"
  echo
  echo "Find your archive in Xcode → Window → Organizer → right-click archive → Show in Finder"
  exit 1
fi

if [ ! -e "$ARCHIVE" ]; then
  echo "ERROR: not found: $ARCHIVE"
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ "$ARCHIVE" == *.xcarchive ]]; then
  APP="$(find "$ARCHIVE/Products/Applications" -name '*.app' -maxdepth 1 | head -1)"
elif [[ "$ARCHIVE" == *.ipa ]]; then
  unzip -q "$ARCHIVE" -d "$WORK"
  APP="$(find "$WORK/Payload" -name '*.app' -maxdepth 1 | head -1)"
else
  echo "ERROR: pass an .xcarchive or .ipa path"
  exit 1
fi

if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "ERROR: no .app bundle found"
  exit 1
fi

ASSETS="$APP/Assets.car"
if [ ! -f "$ASSETS" ]; then
  echo "FAIL: Assets.car missing — icon was not compiled into the app"
  exit 1
fi

echo "OK: Assets.car exists ($(wc -c < "$ASSETS") bytes)"

if command -v assetutil >/dev/null 2>&1; then
  echo
  echo "==> assetutil (look for 1024x1024 AppIcon entries):"
  assetutil --info "$ASSETS" | grep -i -E '1024|AppIcon|marketing' || true
  if assetutil --info "$ASSETS" | grep -q '1024'; then
    echo
    echo "PASS: 1024px icon found in compiled assets"
  else
    echo
    echo "FAIL: no 1024px icon in Assets.car — App Store Connect will show blank icon"
    exit 1
  fi
else
  echo "Note: install Xcode command line tools for assetutil deep check"
fi

PLIST="$APP/Info.plist"
if [ -f "$PLIST" ]; then
  echo
  echo "==> CFBundleIconName in built app:"
  plutil -p "$PLIST" | grep -i icon || true
fi

echo
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' "$ROOT/ios/App/App.xcodeproj/project.pbxproj" 2>/dev/null | sed 's/[^0-9]*//g')
echo "If this passes, upload this archive to App Store Connect as build ${BUILD:-?}."
