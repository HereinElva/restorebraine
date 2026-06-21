#!/usr/bin/env bash
# Force Mac repo to match GitHub exactly. Use when git pull fails or scripts are missing.
#
# Usage:
#   bash scripts/mac-sync-github.sh
#   bash scripts/mac-sync-github.sh && bash scripts/mac-build.sh --no-git
set -euo pipefail

REPO="${RESTOREBRAINE_REPO:-$HOME/restorebraine}"
BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-native-localhost-oauth-bacf}"
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
git fetch "$REMOTE" "$BRANCH"

git checkout -B "$BRANCH" "FETCH_HEAD"
git reset --hard "FETCH_HEAD"

# Ensure origin remote exists for future commands
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi
git branch --set-upstream-to="origin/$BRANCH" "$BRANCH" 2>/dev/null || true

rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets

AFTER=$(git rev-parse --short HEAD)
MSG=$(git log -1 --oneline)

echo ""
echo "Mac is now:  $AFTER"
echo "             $MSG"
echo ""

FAIL=0
for f in scripts/mac-build.sh scripts/mac-unblock-pull.sh; do
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
  echo "Next:"
  echo "  bash scripts/mac-build.sh --no-git"
else
  echo "FAIL — still missing scripts. Check internet / repo URL."
  exit 1
fi

echo ""
echo "Note: Base44 website is SEPARATE from GitHub."
echo "  GitHub → your Mac (this script)"
echo "  Base44 live site does NOT auto-update from GitHub"
echo "  iPhone build uses Mac/git — NOT Base44 paste (mac-build.sh --bundled)"
echo ""
