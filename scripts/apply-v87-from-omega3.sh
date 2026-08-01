#!/usr/bin/env bash
# apply-v87-from-omega3.sh — Terminal-only: Mac bundled build → iPhone (no Safari / Base44 Publish)
#
# This is the primary Mac command. Phone loads capacitor:// ios/public from Xcode.
#
# Usage:
#   cd ~/restorebraine
#   git fetch origin cursor/apple-privacy-plist-bacf
#   git reset --hard origin/cursor/apple-privacy-plist-bacf
#   npm install
#   npm run apply:v87-from-omega3
#   npm run audit:v87-improvements
#
# Or one shot: npm run mac:terminal-build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${APPLY_BRANCH:-cursor/apple-privacy-plist-bacf}"
MODE="bundled"
OPEN_XCODE=1
SKIP_SYNC=0

for arg in "$@"; do
  case "$arg" in
    --bundled) MODE="bundled" ;;
    --hosted) MODE="hosted" ;;
    --no-open) OPEN_XCODE=0 ;;
    --skip-sync) SKIP_SYNC=1 ;;
    -h|--help)
      cat << 'EOF'
Terminal-only apply — v87 + Omega 3 gallery → bundled ios/public on iPhone

  npm run apply:v87-from-omega3              Default: bundled (Mac terminal, no Safari)
  npm run apply:v87-from-omega3 -- --hosted  Legacy: loads live Base44 (needs Publish)

Default flow (all Terminal):
  git fetch + reset + npm install
  Port Omega 3 gallery stack
  npm run build:native-local (bundled UI in ios/public)
  Sync ghost blocklist (new build allowed, stale builds blocked)
  pod install

After: Delete app → Restart iPhone → Xcode Clean Build Folder → Run
Look for green bar: BUNDLED · BUILD_STAMP · index-*.js
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

wipe_build_debris() {
  git clean -fd -- dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true
  rm -rf ios/App/Pods ios/App/Podfile.lock 2>/dev/null || true
  if [[ "$(uname -s)" == "Darwin" ]]; then
    DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
    if [[ -d "$DERIVED" ]]; then
      find "$DERIVED" -maxdepth 1 -type d \( -name 'App-*' -o -name '*restorebraine*' -o -name '*Restorebraine*' \) \
        -exec rm -rf {} + 2>/dev/null || true
    fi
  fi
}

banner "APPLY v87 FROM OMEGA 3 — mode: $MODE (terminal-only)"
echo " No Safari · No Base44 Publish · Phone UI from Mac ios/public"
echo

if [[ "$SKIP_SYNC" != "1" ]]; then
  echo "==> [1/8] Sync branch"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  npm install
else
  echo "==> [1/8] Skip sync (--skip-sync)"
fi

echo
echo "==> [2/8] Wipe stale bundles (old builds block new ones in WKWebView / Xcode)"
wipe_build_debris

echo
echo "==> [3/8] Port Omega 3 gallery stack (finishing touches)"
node scripts/port-omega3-gallery-to-v87.mjs

if [[ "$MODE" == "hosted" ]]; then
  echo
  echo "==> [4/8] Hosted shell (UI still from Base44 CDN — not terminal-only)"
  node scripts/write-build-info.mjs
  npm run build:web
  node scripts/use-local-native-bundle.mjs --hosted
  npx cap sync ios
  node scripts/sync-ghost-builds-native.mjs
  if [[ "$(uname -s)" == "Darwin" ]]; then
    (cd ios/App && pod install)
  fi
else
  echo
  echo "==> [4/8] Bundled native build (terminal pushes UI to iPhone)"
  npm run build:native-local

  echo
  echo "==> [5/8] CocoaPods"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    (cd ios/App && pod install)
  else
    echo "    (skip pod install — not on macOS)"
  fi

  echo
  echo "==> [6/8] Ghost blocklist — allow THIS build, block stale bundles"
  node scripts/sync-ghost-builds-native.mjs
  node scripts/prove-bundled-ghost-safe.mjs
fi

echo
echo "==> [7/8] Verify phone load mode"
node scripts/prove-phone-load.mjs || true

echo
echo "==> [8/8] Audits"
node scripts/audit-v87-improvements.mjs || true
node scripts/audit-interference.mjs || true

banner "NEXT ON IPHONE (required every build)"
echo " 1. Delete Restorebraine from iPhone"
echo " 2. Restart iPhone (power off → wait 30s → on)"
echo " 3. Xcode → Product → Clean Build Folder"
echo " 4. Run on iPhone"
echo
if [[ "$MODE" == "bundled" ]]; then
  STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo '?')"
  ENTRY="$(grep -oE 'index-[^"]+\.js' ios/App/App/public/index.html 2>/dev/null | head -1 || echo '?')"
  echo " EXPECTED: green bar at bottom"
  echo "   BUNDLED · ${STAMP} · ${ENTRY}"
  echo
  echo " AUTH FLOW:"
  echo "   1. Signed-out landing — Find Your Memories + Sign In button"
  echo "   2. Tap Sign In → Google OAuth"
  echo "   3. Gallery front page — Find Your Memories + search (after login)"
else
  echo " Hosted mode — UI from Base44 CDN (not terminal-only)"
fi
echo "══════════════════════════════════════════════════════════════"

if [[ "$OPEN_XCODE" == "1" && "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || true
fi
