#!/usr/bin/env bash
# fix-no-change.sh — one Mac command when iPhone UI still shows "no change"
#
# Default: BUNDLED mode (phone UI from Mac/ios/public — NOT Base44 CDN)
# Hosted UI changes still require Base44 Publish after src/ edits.
#
# Usage:
#   npm run fix:no-change
#   npm run fix:no-change -- --hosted
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="bundled"
for arg in "$@"; do
  case "$arg" in
    --hosted) MODE="hosted" ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " FIX NO-CHANGE — mode: $MODE"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1/4] Sync branch + install"
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install

echo
echo "==> [2/4] Clear blockers + rebuild"
if [[ "$MODE" == "hosted" ]]; then
  npm run blocks:clear -- --hosted
else
  npm run blocks:clear
fi

echo
echo "==> [3/4] Audit"
node scripts/audit-interference.mjs || true
node scripts/explain-no-change.mjs || true

echo
echo "==> [4/4] REQUIRED on iPhone (every time)"
echo "  1. Delete Restorebraine from iPhone"
echo "  2. Restart iPhone (power off → wait 30s → on)"
echo "  3. Xcode → Product → Clean Build Folder"
echo "  4. Run on iPhone"
echo
if [[ "$MODE" == "bundled" ]]; then
  echo " Bundled: phone loads capacitor:// from ios/public"
  echo " Git + Xcode changes WILL show — no Base44 Publish needed"
else
  echo " Hosted: phone loads https://restorebraine.base44.app"
  echo " UI changes need Base44 Publish: npm run base44:export-pack"
fi
echo "══════════════════════════════════════════════════════════════"
