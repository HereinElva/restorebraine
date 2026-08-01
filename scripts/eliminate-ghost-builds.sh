#!/usr/bin/env bash
# Eliminate ghost builds on DEVICE (WKWebView cache + JS blocklist).
# Cannot delete files from Base44 CDN — blocks cached loads instead.
#
# Usage: npm run ghosts:eliminate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "══════════════════════════════════════════════════════════════"
echo " GHOST BUILD ELIMINATION — device-side (CDN files stay on server)"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1/4] Discover all ghosts since Omega 3 (git + CDN probe)"
node scripts/discover-ghost-builds.mjs || DISCOVER=$?
DISCOVER="${DISCOVER:-0}"
echo

if [[ ! -f ios/App/App/ghost-builds.txt ]]; then
  node scripts/sync-ghost-builds-native.mjs
fi

echo "==> [2/4] Bump BUILD_STAMP + sync ghost blocklist (forces WKWebView cache purge)"
node scripts/write-build-info.mjs
node scripts/discover-ghost-builds.mjs || true

echo "==> [3/4] Sync Capacitor iOS shell (keep hosted — UI still from Base44)"
node scripts/use-local-native-bundle.mjs --hosted 2>/dev/null || true
npx cap sync ios

echo "==> [4/4] CocoaPods"
(cd ios/App && pod install)

echo "==> Summary"
echo " Ghost blocklist: ios/App/App/ghost-builds.txt"
echo " Report:          reports/ghost-builds-report.json"
echo
echo " Xcode: Delete app → Clean Build Folder → Run"
echo " AppDelegate purges WKWebView cache when BUILD_STAMP changes."
echo " Injected JS reloads if any ghost filename is loaded."
echo "══════════════════════════════════════════════════════════════"

exit 0
