#!/usr/bin/env bash
# fix-no-change.sh — one Mac command when iPhone UI still shows white screen / no change
#
# Default: HOSTED mode (loads live Base44 — most reliable on iPhone)
# Bundled (experimental): npm run fix:no-change -- --bundled
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="hosted"
for arg in "$@"; do
  case "$arg" in
    --bundled) MODE="bundled" ;;
    --hosted) MODE="hosted" ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " FIX NO-CHANGE — mode: $MODE"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1/5] Sync branch + install"
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install

echo
echo "==> [2/5] Clear blockers + rebuild"
if [[ "$MODE" == "hosted" ]]; then
  npm run blocks:clear -- --hosted
else
  npm run blocks:clear
fi

echo
echo "==> [3/5] Verify build actually completed"
if [[ "$MODE" == "bundled" ]]; then
  if grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
    echo ""
    echo "✗ BUILD FAILED — ios config still has server.url (hosted mode)"
    echo "  Phone will load Base44 CDN — Mac changes will NOT appear."
    echo "  Re-run: npm run build:native-local"
    echo "  If icons fail, run: npm install"
    exit 1
  fi
  node scripts/verify-bundled-v87.mjs
fi

echo
echo "==> [4/5] Audit + auth flow diagnosis"
node scripts/audit-interference.mjs || true
node scripts/prove-phone-load.mjs || true
node scripts/diagnose-auth-flow.mjs || true

echo
echo "==> [5/5] REQUIRED on iPhone (every time — skip = no change)"
echo "  1. Delete Restorebraine from iPhone"
echo "  2. Restart iPhone (power off → wait 30s → on)"
echo "  3. Xcode → Product → Clean Build Folder"
echo "  4. Run on iPhone"
echo
if [[ "$MODE" == "bundled" ]]; then
  STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo '?')"
  ENTRY="$(grep -oE 'index-[^"]+\.js' ios/App/App/public/index.html 2>/dev/null | head -1 || echo '?')"
  echo " Bundled mode: look for green bar: BUNDLED · ${STAMP} · ${ENTRY}"
  echo " If still white screen, retry with hosted mode:"
  echo "   npm run fix:no-change -- --hosted"
else
  echo " Hosted: phone loads https://restorebraine.base44.app (reliable — no white screen)"
  echo ""
  echo " EXPECTED ON IPHONE (3 steps — do not confuse):"
  echo "   1. Signed-out landing — Find Your Memories + Sign In button (not logged in)"
  echo "   2. Tap Sign In → Google OAuth login"
  echo "   3. Front page — Gallery with Find Your Memories + search (after login)"
  echo ""
  echo " Omega 3 gallery improvements in src/ need Base44 Publish to appear on phone:"
  echo "   npm run base44:export-pack"
  echo " For Mac-only UI (experimental): npm run fix:no-change -- --bundled"
fi
echo "══════════════════════════════════════════════════════════════"
