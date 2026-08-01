#!/usr/bin/env bash
# clear-all-blocks.sh — remove ALL lingering blocks: ghosts + WKWebView cache + bundled UI
#
# Hosted Xcode builds load live Base44 (default — most reliable on iPhone).
# Use --bundled only when you need Mac terminal to control UI without Base44 Publish.
#
# Usage:
#   npm run blocks:clear              # hosted (default — reliable on iPhone)
#   npm run blocks:clear -- --bundled # bundled v87 from Mac (experimental)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="hosted"
for arg in "$@"; do
  case "$arg" in
    --bundled) MODE="bundled" ;;
    --hosted) MODE="hosted" ;;
    -h|--help)
      cat << 'EOF'
Clear all iPhone update blockers

  npm run blocks:clear              Hosted + WKWebView purge (default — reliable)
  npm run blocks:clear -- --bundled Bundled v87 from Mac (experimental)

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
echo "==> [4/5] Interference + ghost audit"
node scripts/audit-interference.mjs || true
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
