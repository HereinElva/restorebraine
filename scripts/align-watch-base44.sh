#!/usr/bin/env bash
# Poll live Base44 until chunk pair + OAuth align with git build.
# Run this in terminal WHILE you paste + Publish in Base44 browser.
#
# Usage:
#   npm run align:watch
#   npm run align:watch -- --interval=15
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INTERVAL=30
MAX_MINUTES=30

for arg in "$@"; do
  case "$arg" in
    --interval=*) INTERVAL="${arg#*=}" ;;
    --max-minutes=*) MAX_MINUTES="${arg#*=}" ;;
    -h|--help)
      echo "Usage: bash scripts/align-watch-base44.sh [--interval=30] [--max-minutes=30]"
      exit 0
      ;;
  esac
done

echo "══════════════════════════════════════════════════════════════"
echo " ALIGN WATCH — poll live Base44 until Publish completes"
echo "══════════════════════════════════════════════════════════════"
echo
echo " Paste ALL 43 files in Base44 editor → click Publish ONCE"
echo " This terminal will detect when live chunks match git."
echo
echo " Export pack: npm run base44:export-pack"
echo " Interval: ${INTERVAL}s   Timeout: ${MAX_MINUTES}m"
echo

# Ensure dist exists for chunk comparison
if [[ ! -f dist/index.html ]]; then
  echo "==> Building dist for comparison (npm run build:web)"
  npm run build:web
fi

START=$(date +%s)
DEADLINE=$((START + MAX_MINUTES * 60))
ATTEMPT=0

while true; do
  ATTEMPT=$((ATTEMPT + 1))
  NOW=$(date +%s)
  if [[ "$NOW" -ge "$DEADLINE" ]]; then
    echo
    echo "✗ Timeout after ${MAX_MINUTES}m — Publish may not be done yet."
    echo "  Re-run: npm run align:watch"
    exit 1
  fi

  STAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo
  echo "[$STAMP] Attempt $ATTEMPT — probing live Base44..."

  OAUTH_OK=0
  CHUNK_OK=0

  if node scripts/prove-live-oauth.mjs >/dev/null 2>&1; then
    OAUTH_OK=1
    echo "  ✓ Live OAuth"
  else
    echo "  ✗ Live OAuth"
  fi

  if node scripts/diagnose-chunk-pair.mjs >/dev/null 2>&1; then
    CHUNK_OK=1
    echo "  ✓ Chunk pair (index + App matched)"
  else
    echo "  ✗ Chunk pair (mixed publish or pending)"
  fi

  if [[ "$OAUTH_OK" == "1" && "$CHUNK_OK" == "1" ]]; then
    echo
    echo "══════════════════════════════════════════════════════════════"
    echo " ✓ LIVE BASE44 ALIGNED — Publish detected"
    echo "══════════════════════════════════════════════════════════════"
    echo
    node scripts/diagnose-chunk-pair.mjs
    echo
    bash scripts/prompt-replace-iphone-app.sh --before-xcode
    echo " Next: npm run align:all -- --no-git-sync --skip-build"
    echo " Then: Xcode → Clean Build Folder → Run"
    exit 0
  fi

  echo "  Waiting ${INTERVAL}s (Publish in Base44 browser now)..."
  sleep "$INTERVAL"
done
