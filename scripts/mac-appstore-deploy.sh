#!/usr/bin/env bash
# App Store / TestFlight — HOSTED mode (Omega-style).
#
# Loads live https://restorebraine.base44.app — login works like Safari / old Omega builds.
# DO NOT run mac-capacitor-web-sync.sh or mac-ios-v4-deploy.sh before Archive — those bundle
# capacitor://localhost OAuth, which breaks login buttons on TestFlight.
#
# Usage:
#   bash scripts/mac-appstore-deploy.sh
#   SKIP_PUBLISH_CHECK=1 bash scripts/mac-appstore-deploy.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  App Store / TestFlight — HOSTED native (Omega-style)        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Reference: App Store 1.0.1 (3) — docs/APPSTORE-BUILD-1.0.1-3.md"
echo "  bash scripts/mac-reconstruct-appstore.sh  (same hosted mode, with build-3 context)"
echo ""
echo "This is the correct path before Product → Archive."
echo "Bundled capacitor://localhost (mac-ios-v4-deploy) is DEV ONLY — login breaks on TestFlight."
echo ""
echo "PREREQ — Base44 Publish (web + hosted native login UI):"
echo "  Paste base44-publish-v${DEPLOY}.txt into Base44 Code editor → Publish"
echo "  Verify in Safari: https://restorebraine.base44.app — Google / Apple / email must work"
echo ""
if [ "${SKIP_PUBLISH_CHECK:-}" != "1" ]; then
  read -r -p "Published to Base44 already? (y/N) " PUBLISHED
  if [[ ! "$PUBLISHED" =~ ^[Yy]$ ]]; then
    echo "Publish first, then: SKIP_PUBLISH_CHECK=1 bash scripts/mac-appstore-deploy.sh"
    exit 1
  fi
fi

echo ""
echo "=== Step 1: hosted WebView mode (server.url → restorebraine.base44.app) ==="
node scripts/use-local-native-bundle.mjs --hosted

echo ""
echo "=== Step 2: build + cap sync ==="
npm run build

URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json | head -1 || true)
echo ""
echo "Config: $URL"
if [[ "$URL" != *"restorebraine.base44.app"* ]]; then
  echo "FAIL: server.url not set — hosted mode failed"
  exit 1
fi

echo ""
echo "=== Step 3: copy config into App.app + verify ==="
bash scripts/mac-copy-public-into-appapp.sh 2>/dev/null || true
bash scripts/verify-hosted-app-bundle.sh 2>/dev/null || {
  echo ""
  echo "No App.app yet — Run once in Xcode, then Archive."
}

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  READY FOR ARCHIVE — v${BUILD_NUM} · hosted native"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next in Xcode:"
echo "  1. open ios/App/App.xcworkspace"
echo "  2. Product → Clean Build Folder"
echo "  3. Product → Archive → Distribute App → App Store Connect"
echo ""
echo "On TestFlight device:"
echo "  • App loads restorebraine.base44.app (NOT capacitor://localhost)"
echo "  • Login = same as Safari on that URL"
echo "  • Purple badge should show mode: native-hosted"
echo ""
echo "Dev-only bundled mode (localhost OAuth experiments):"
echo "  bash scripts/mac-capacitor-web-sync.sh"
echo ""
