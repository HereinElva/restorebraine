#!/usr/bin/env bash
# clear-all-blocks.sh — remove ALL lingering blocks: ghosts + WKWebView cache + bundled UI
#
# Hosted Xcode builds CANNOT change iPhone UI (loads live Base44).
# This script switches to BUNDLED mode so Mac terminal controls what the phone shows.
#
# Usage:
#   npm run blocks:clear          # bundled v87 (recommended — no CDN ghosts)
#   npm run blocks:clear -- --hosted   # purge cache only, stay on Base44 CDN
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="bundled"
for arg in "$@"; do
  case "$arg" in
    --hosted) MODE="hosted" ;;
    -h|--help)
      cat << 'EOF'
Clear all iPhone update blockers

  npm run blocks:clear              Bundled v87 from Mac (bypasses Base44 CDN entirely)
  npm run blocks:clear -- --hosted  WKWebView purge only (UI still from live Base44)

After either mode:
  Delete Restorebraine on iPhone → Restart iPhone → Xcode Clean Build Folder → Run
EOF
      exit 0
      ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " CLEAR ALL BLOCKS — mode: $MODE"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1/5] Full ghost scan + expanded blocklist (408+ historical bundles)"
node scripts/discover-ghost-builds.mjs || true
node scripts/sync-ghost-builds-native.mjs

echo
echo "==> [2/5] Diagnose remaining blockers"
node scripts/diagnose-blockages.mjs || true

echo
if [[ "$MODE" == "bundled" ]]; then
  echo "==> [3/5] Bundled v87 build (phone UI from Mac — NOT Base44 CDN)"
  npm run apply:v87-from-omega3 -- --no-open
else
  echo "==> [3/5] Hosted shell + cache purge (UI still from Base44 Publish)"
  node scripts/write-build-info.mjs
  node scripts/use-local-native-bundle.mjs --hosted
  npx cap sync ios
  (cd ios/App && pod install)
fi

echo
echo "==> [4/5] Final ghost audit"
node scripts/audit-ghost-builds-all.mjs || true

echo
echo "==> [5/5] REQUIRED on iPhone (every time — not optional)"
echo "  1. Delete Restorebraine app from iPhone"
echo "  2. Restart iPhone (hold power → slide off → wait 30s → on)"
echo "  3. Xcode → Product → Clean Build Folder"
echo "  4. Run on iPhone"
echo
if [[ "$MODE" == "bundled" ]]; then
  echo " Bundled mode: phone loads capacitor:// from ios/public"
  echo " Git/Xcode changes WILL appear — no Base44 Publish needed"
else
  echo " Hosted mode: phone still loads restorebraine.base44.app"
  echo " UI changes still require Base44 Publish: npm run base44:export-pack"
fi
echo "══════════════════════════════════════════════════════════════"
