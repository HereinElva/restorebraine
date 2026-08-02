#!/usr/bin/env bash
# restore-omega-7.sh — byte-exact Omega 7 archive restore (no port, no rebuild, no drift)
#
# Usage:
#   npm run restore:omega-7
#   bash scripts/restore-omega-7.sh
#
# Rebuild from source (NOT byte-exact archive):
#   bash scripts/restore-omega-7.sh --rebuild
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="omega-7"
REBUILD=0

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    -h|--help)
      cat << 'EOF'
Restore Omega 7 — frozen bundled archive (v107)

  npm run restore:omega-7              Exact tag restore (recommended for archive)
  npm run restore:omega-7 -- --rebuild Rebuild ios/public from source (new index-*.js hash)

NEVER after restore (breaks archive / ghosts):
  npm run fix:no-change
  npm run ghosts:scan / ghosts:discover / ghosts:eliminate
  npm run apply:v87-from-omega3
  npm run port:omega3-gallery
  npm run build

SAFE:
  npm run verify:omega-7
  npm run verify:login-organize
  npm run ghosts:sync   (refreshes CDN allow lines + keeps bundled + entries)

Then: Delete app → Restart iPhone → Xcode Clean → Run / Archive
EOF
      exit 0
      ;;
  esac
done

banner() {
  echo
  echo "══════════════════════════════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════════════════════════════"
}

banner "RESTORE OMEGA 7 — frozen bundled archive v107"

echo "==> [1] Fetch tag and reset (byte-exact — no branch drift)"
git fetch origin --tags
git fetch origin cursor/apple-privacy-plist-bacf 2>/dev/null || true
git reset --hard "$TAG"

echo
echo "==> [2] npm install (does not touch committed ios/public)"
npm install

echo
echo "==> [3] Bundled mode (remove server.url if present)"
node scripts/use-local-native-bundle.mjs --local 2>/dev/null || true

if [[ "$REBUILD" == "1" ]]; then
  echo
  echo "==> [--rebuild] Full native rebuild (NEW index hash — not byte-exact archive)"
  npm run build:native-local
else
  echo
  echo "==> [4] Ghost sync — ALLOW bundled assets, BLOCK stale WKWebView (no wipe/rebuild)"
  node scripts/sync-ghost-builds-native.mjs
  node scripts/prove-bundled-ghost-safe.mjs
fi

echo
echo "==> [5] Verify Omega 7 archive"
node scripts/verify-omega-7-archive.mjs
node scripts/verify-login-organize-regression.mjs

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo
  echo "==> [6] CocoaPods"
  (cd ios/App && pod install) || echo "    (pod install skipped if unavailable)"
fi

banner "OMEGA 7 READY"
STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo '?')"
ENTRY="$(grep -oE 'index-[^"]+\.js' ios/App/App/public/index.html 2>/dev/null | head -1 || echo '?')"
echo " BUILD_STAMP: ${STAMP}"
echo " Bundled:     ${ENTRY}"
echo " Green bar:   BUNDLED · ${STAMP} · ${ENTRY}"
echo
echo " Next: Delete app → Restart iPhone → Xcode Clean → Run or Archive"
echo " Label archive: Omega 7"
echo "══════════════════════════════════════════════════════════════"
