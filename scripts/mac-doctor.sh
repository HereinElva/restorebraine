#!/usr/bin/env bash
# Diagnose iOS deploy pipeline — run on Mac when verify fails or device shows "no change".
set -uo pipefail
BRANCH="${1:-cursor/fix-native-localhost-oauth-bacf}"
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine iOS doctor ==="
echo ""

CURRENT=$(git branch --show-current 2>/dev/null || echo unknown)
echo "Branch: $CURRENT (target: $BRANCH)"

if [ "$CURRENT" = "cursor/fix-native-xcode-coding-bacf" ]; then
  echo ""
  echo "WRONG BRANCH — you are on old v60 work (fix-native-xcode-coding-bacf)."
  echo "  Fix NOW: bash scripts/mac-recover-v4.sh"
  echo "  Or:     git fetch origin $BRANCH && git checkout -B $BRANCH origin/$BRANCH"
fi

git fetch origin "$BRANCH" 2>/dev/null || true
LOCAL=$(git rev-parse HEAD 2>/dev/null || echo none)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)
echo "Commit: local=${LOCAL:0:7}  origin/${BRANCH}=${REMOTE:0:7}"

if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != none ]; then
  echo ""
  echo "OUT OF SYNC — local repo is behind origin (git pull will fail if build files changed)."
  echo "  Fix: bash scripts/mac-force-sync.sh"
  echo "    or: bash scripts/mac-ios-v4-rebuild.sh   (sync + rebuild in one step)"
fi

if [ "$CURRENT" != "$BRANCH" ]; then
  echo ""
  echo "WRONG BRANCH — native-local fixes are on $BRANCH."
  echo "  Fix: bash scripts/mac-force-sync.sh"
fi

VERIFY="$PWD/scripts/verify-xcode-app-bundle.sh"
if [ -f "$VERIFY" ]; then
  if grep -q 'find_deployed_app' "$VERIFY"; then
    echo ""
    echo "verify-xcode-app-bundle.sh: OK (ignores Index.noindex hollow builds)"
  else
    echo ""
    echo "OUTDATED verify-xcode-app-bundle.sh — matches Index.noindex and falsely fails."
    echo "  Fix: bash scripts/mac-force-sync.sh"
  fi
else
  echo ""
  echo "Missing scripts/verify-xcode-app-bundle.sh"
fi

REPO_STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
REPO_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)
echo ""
echo "Repo BUILD_STAMP: $REPO_STAMP"
echo "Repo entry JS:    $REPO_ENTRY"

if [ ! -f "ios/App/App/public/index.html" ]; then
  echo ""
  echo "ios/App/App/public/ missing — run: bash scripts/mac-ios-v4-rebuild.sh"
fi

URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json 2>/dev/null || true)
URL_COUNT=${URL_COUNT:-0}
echo "server.url in capacitor.config.json: $URL_COUNT (must be 0 for v4-core)"

if [ -d "$HOME/Library/Developer/Xcode/DerivedData" ]; then
  echo ""
  echo "=== Xcode DerivedData ==="
  INDEX_APPS=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name 'App.app' -path '*Index.noindex*' -path '*/Build/Products/*' 2>/dev/null | wc -l | tr -d ' ')
  DEPLOYED=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name 'App.app' -path '*/Build/Products/*' ! -path '*Index.noindex*' ! -path '*Build/Intermediates*' 2>/dev/null)
  DEPLOYED_WITH_PUBLIC=0
  while IFS= read -r app; do
    [ -n "$app" ] || continue
    [ -f "$app/public/index.html" ] && DEPLOYED_WITH_PUBLIC=$((DEPLOYED_WITH_PUBLIC + 1))
  done <<< "$DEPLOYED"

  echo "Index.noindex App.app shells: $INDEX_APPS (empty — NOT installed on device)"
  echo "Real App.app with public/:     $DEPLOYED_WITH_PUBLIC"

  if [ "$INDEX_APPS" -gt 0 ] && [ "$DEPLOYED_WITH_PUBLIC" -eq 0 ]; then
    echo ""
    echo "ONLY Index builds found — Xcode indexed the project but never Ran to device."
    echo "  Fix: Xcode -> Run (Cmd+R) to your iPhone (not just Build)"
    echo "  Build log must show: Restorebraine DEPLOY OK"
  fi
fi

echo ""
echo "=== Recommended sequence ==="
echo "  1. bash scripts/mac-force-sync.sh"
echo "  2. bash scripts/mac-ios-v4-rebuild.sh"
echo "  3. Xcode: delete app -> Clean Build Folder -> Run (Cmd+R) to iPhone"
echo "  4. bash scripts/verify-xcode-app-bundle.sh"
echo ""
echo "If still stale: bash scripts/mac-nuclear-scrub.sh"
