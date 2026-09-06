#!/usr/bin/env bash
# Force Mac repo to match GitHub exactly. Use when git pull fails or scripts are missing.
#
# Usage:
#   bash scripts/mac-sync-github.sh
#   bash scripts/mac-sync-github.sh && bash scripts/mac-build.sh --no-git
set -euo pipefail

REPO="${RESTOREBRAINE_REPO:-$HOME/restorebraine}"
BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-folder-persistence-bacf}"
REMOTE="${RESTOREBRAINE_REMOTE:-https://github.com/HereinElva/restorebraine.git}"

if [ ! -d "$REPO/.git" ]; then
  echo "FAIL: Not a git repo: $REPO"
  echo "Clone first:"
  echo "  git clone $REMOTE ~/restorebraine"
  exit 1
fi

cd "$REPO"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SYNC MAC ← GITHUB                                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Repo:   $REPO"
echo "Branch: $BRANCH"
echo "Remote: $REMOTE"
echo ""

BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo none)
echo "Mac was at:  $BEFORE"

echo "Fetching from GitHub..."
git fetch origin "$BRANCH"
git fetch origin --tags 2>/dev/null || true

# Ensure origin remote matches RESTOREBRAINE_REMOTE
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi

TARGET="origin/$BRANCH"
if ! git rev-parse --verify "$TARGET^{commit}" >/dev/null 2>&1; then
  echo "FAIL: $TARGET not found after fetch — check network and branch name"
  exit 1
fi

echo "Discarding local build artifacts (build-info.js, configs) before reset..."
bash scripts/mac-discard-build-files.sh 2>/dev/null || true

git checkout -B "$BRANCH" "$TARGET"
git reset --hard "$TARGET"
git branch --set-upstream-to="$TARGET" "$BRANCH" 2>/dev/null || true

rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets

AFTER=$(git rev-parse --short HEAD)
MSG=$(git log -1 --oneline)
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

echo ""
echo "Mac is now:  $AFTER"
echo "             $MSG"
echo "             deploy v${DEPLOY}"
echo ""

if [ "${DEPLOY:-0}" -lt 295 ] 2>/dev/null; then
  echo "WARN: deploy v${DEPLOY} is behind expected v295+ — fetch may have been stale."
  echo "  Run: git fetch origin $BRANCH && git reset --hard origin/$BRANCH"
  echo ""
fi

FAIL=0
for f in scripts/mac-build.sh scripts/mac-sync-apple-fix.sh scripts/mac-apple-login-bundled.sh; do
  if [ -f "$f" ]; then
    echo "OK: $f"
  else
    echo "FAIL: missing $f"
    FAIL=1
  fi
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "████████████████████████████████████████████████████████████"
  echo "██  PASS — Mac matches GitHub                               ██"
  echo "████████████████████████████████████████████████████████████"
  echo ""
  echo "Next (hosted App Store shell — loads Base44 live):"
  echo "  bash scripts/mac-recover-hosted.sh"
  echo "  or: bash scripts/mac-build.sh --hosted --no-git"
else
  echo "FAIL — still missing scripts. Check internet / repo URL."
  exit 1
fi

echo ""
echo "Note: Base44 website is SEPARATE from GitHub."
echo "  GitHub → your Mac (this script)"
echo "  Base44 live site does NOT auto-update from GitHub"
echo "  App Store / TestFlight: bash scripts/mac-build.sh --hosted (UI from Base44)"
echo "  Diagnose no-change: bash scripts/mac-diagnose-mobile.sh"
echo ""
