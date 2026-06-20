#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

force_clean_ios_public() {
  echo "Force-cleaning ios/App/App/public (cap-sync artifacts)..."
  rm -rf ios/App/App/public/assets
  mkdir -p ios/App/App/public/assets
  git checkout -f HEAD -- ios/App/App/public/ 2>/dev/null \
    || git restore --worktree ios/App/App/public/ 2>/dev/null \
    || true
  git clean -ffdx ios/App/App/public/assets/ 2>/dev/null || true
}

echo "=== Restorebraine iOS native-local rebuild ==="
force_clean_ios_public
bash scripts/mac-discard-build-files.sh

echo "Pulling $BRANCH ..."
if ! git pull origin "$BRANCH"; then
  echo ""
  echo "Pull blocked — Xcode often modifies ios/App/App.xcodeproj/project.pbxproj."
  echo "Restoring tracked files and retrying..."
  force_clean_ios_public
  bash scripts/mac-discard-build-files.sh
  git checkout -f HEAD -- ios/App/App.xcodeproj/project.pbxproj 2>/dev/null \
    || git restore --staged --worktree ios/App/App.xcodeproj/project.pbxproj 2>/dev/null \
    || true
  if ! git pull origin "$BRANCH"; then
    echo ""
    echo "Pull still blocked. Run this, then rebuild:"
    echo "  bash scripts/mac-unblock-pull.sh"
    exit 1
  fi
fi

echo "Building native-local bundle..."
npm run build:native-local

URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json || true)
echo ""
if [[ "$URL_COUNT" == "0" ]]; then
  echo "OK: native-local mode (no server.url)"
else
  echo "WARNING: server.url still set — app will load Base44 website, not native bundle"
  echo "Run: npm run build:native-local"
fi

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')

XCODE_BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]*//g')

echo ""
echo "=== VERIFY on device ==="
echo "Look for purple badge bottom-left: v${BUILD_NUM} · native-local"
echo "Badge should show BUILD_STAMP timestamp matching Terminal output above"
echo "Login: Continue with Google -> Google picker (not app.base44.com welcome page)"
echo ""
echo "Next in Xcode (required — otherwise device keeps stale WKWebView cache):"
echo "  1. Delete Restorebraine from device/simulator"
echo "  2. Product -> Clean Build Folder (Shift+Cmd+K)"
echo "  3. If still stale: Xcode -> Settings -> Locations -> Derived Data -> delete App folder"
echo "  4. Run (Cmd+R) — CFBundleVersion should be ${XCODE_BUILD} (matches v${BUILD_NUM})"
echo ""
echo "Native-local = bundled app shell (no Base44 URL bar). Gallery + Back button fixes included."
echo "For App Store hosted mode instead: bash scripts/mac-ios-hosted-rebuild.sh"
