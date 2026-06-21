#!/usr/bin/env bash
set -euo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

force_clean_ios_public() {
  echo "Force-cleaning ios/App/App/public (never restore from git — stale bundles cause no-change on device)..."
  rm -rf ios/App/App/public
  mkdir -p ios/App/App/public/assets
  git clean -ffdx ios/App/App/public/ 2>/dev/null || true
}

echo "=== Restorebraine iOS native-local rebuild ==="
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "WARNING: you are on branch '$CURRENT_BRANCH' but native-local work is on '$BRANCH'"
  echo "  Run: bash scripts/mac-pull-and-rebuild.sh"
  exit 1
fi

git fetch origin "$BRANCH" 2>/dev/null || true
LOCAL=$(git rev-parse HEAD 2>/dev/null || echo unknown)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo unknown)
echo "Branch: $BRANCH  local=${LOCAL:0:7}  remote=${REMOTE:0:7}"
if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != unknown ]; then
  echo "NOTE: local branch differs from origin/$BRANCH — pull will update scripts (v102+ audit fixes)"
fi

# --sync or RESTOREBRAINE_SYNC=1: pull origin before build (legacy behavior).
SYNC=0
for arg in "$@"; do
  [ "$arg" = "--sync" ] && SYNC=1
done
[ "${RESTOREBRAINE_SYNC:-0}" = "1" ] && SYNC=1

force_clean_ios_public
bash scripts/mac-discard-build-files.sh

if [ "$SYNC" = "1" ]; then
  echo "Syncing to origin/$BRANCH ..."
  git fetch origin "$BRANCH"
  if git diff --quiet HEAD 2>/dev/null \
    && git diff --cached --quiet HEAD 2>/dev/null \
    && [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ]; then
    echo "Already up to date at $(git rev-parse --short HEAD)."
  else
    if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
      echo "Discarding local build-artifact changes (build-info, deploy-marker, pbxproj) ..."
      bash scripts/mac-discard-build-files.sh
    fi
    git reset --hard "origin/$BRANCH"
    echo "Synced to: $(git log --oneline -1)"
  fi
else
  echo "Building current checkout (no git reset). Use --sync to pull origin/$BRANCH first."
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
if [ "$BUILD_NUM" -le 101 ] 2>/dev/null; then
  echo ""
  echo "WARNING: still on v${BUILD_NUM}. Pull latest branch for v102 audit (force Xcode copy public/, auto bump build)."
  echo "  git fetch origin $BRANCH && git pull origin $BRANCH && bash scripts/mac-ios-native-rebuild.sh"
fi

XCODE_BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]*//g')

echo ""
echo "=== VERIFY on device ==="
echo "Look for purple badge: v${BUILD_NUM} · v4-core"
echo "Xcode build log MUST show: Restorebraine DEPLOY OK"
echo "After Run verify: bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "npm build done — iPhone NOT updated yet. Run ONE of:"
echo "  bash scripts/mac-ios-v4-install.sh     (CLI install to connected iPhone)"
echo "  bash scripts/mac-ios-v4-deploy.sh      (build + install)"
echo ""
echo "Or in Xcode:"
echo "  0. Signing: App target -> Signing & Capabilities -> Team = your Apple ID"
echo "  1. Delete Restorebraine from device"
echo "  2. Product -> Clean Build Folder (Shift+Cmd+K)"
echo "  3. Run (Cmd+R) — CFBundleVersion ${XCODE_BUILD}"
echo "  4. Build log MUST show: Restorebraine DEPLOY OK"
echo ""
echo "Native-local = bundled app shell (no Base44 URL bar). Gallery + Back button fixes included."
echo "For App Store hosted mode instead: bash scripts/mac-ios-hosted-rebuild.sh"
