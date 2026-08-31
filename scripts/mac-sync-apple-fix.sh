#!/usr/bin/env bash
# Fix "git pull would overwrite local changes" + get Apple login scripts + build bundled ios/public.
#
# Usage:
#   bash scripts/mac-sync-apple-fix.sh
#   bash scripts/mac-sync-apple-fix.sh --no-git   # skip fetch if already synced
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${RESTOREBRAINE_BRANCH:-cursor/fix-folder-persistence-bacf}"
REMOTE="${RESTOREBRAINE_REMOTE:-origin}"
SKIP_GIT=0

for arg in "$@"; do
  case "$arg" in
    --no-git) SKIP_GIT=1 ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Sync Apple fix branch + bundled build                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ "$SKIP_GIT" = "0" ]; then
  BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo none)
  echo "Mac was at: $BEFORE"
  echo ""
  echo "Discarding local build-file changes (index.html, build-info, pbxproj)..."
  if [ -f scripts/mac-discard-build-files.sh ]; then
    bash scripts/mac-discard-build-files.sh
  else
    rm -rf ios/App/App/public
    mkdir -p ios/App/App/public/assets
  fi
  echo ""
  echo "Fetching $BRANCH from GitHub..."
  git fetch "$REMOTE" "$BRANCH"
  git checkout -B "$BRANCH" "$REMOTE/$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "FETCH_HEAD"
  git reset --hard "$REMOTE/$BRANCH" 2>/dev/null || git reset --hard "FETCH_HEAD"
  AFTER=$(git rev-parse --short HEAD)
  echo "Mac is now: $AFTER — $(git log -1 --oneline)"
  echo ""
fi

for f in scripts/mac-apple-login-bundled.sh scripts/mac-xcode-run-checklist.sh scripts/mac-sync-apple-fix.sh; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing after sync — run:"
    echo "  git fetch origin $BRANCH && git reset --hard origin/$BRANCH"
    exit 1
  fi
done

echo "Running bundled build..."
bash scripts/mac-apple-login-bundled.sh --no-git

echo ""
echo "Next: bash scripts/mac-xcode-run-checklist.sh"
