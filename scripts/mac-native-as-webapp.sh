#!/usr/bin/env bash
# NEW APPROACH: Native iPhone app = Capacitor shell that loads the LIVE web app.
# No bundled login sync. Same code, same OAuth, same UI as restorebraine.base44.app in Safari.
#
# PREREQ: Publish latest code in Base44 (base44-publish-v*.txt) so the live site has SignInScreen.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Native as Web App — loads live restorebraine.base44.app     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This stops fighting capacitor://localhost bundled sync."
echo "Your iPhone WebView opens the SAME site as the working web app."
echo ""
echo "PREREQ — Base44 Publish (one time per code change):"
echo "  Paste base44-publish-v${DEPLOY}.txt into Base44 Code editor → Publish"
echo "  Verify in Safari: https://restorebraine.base44.app shows new login"
echo ""

read -r -p "Have you Published to Base44? (y/N) " PUBLISHED
if [[ ! "$PUBLISHED" =~ ^[Yy]$ ]]; then
  echo ""
  echo "Publish first, then re-run: bash scripts/mac-native-as-webapp.sh"
  echo "  node scripts/list-base44-publish-files.mjs"
  exit 1
fi

echo ""
echo "=== Step 1: switch to hosted WebView mode ==="
node scripts/use-local-native-bundle.mjs --hosted

echo ""
echo "=== Step 2: build + cap sync (plugins + config) ==="
npm run build

URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json | head -1 || true)
echo ""
echo "Config: $URL"
if [[ "$URL" != *"restorebraine.base44.app"* ]]; then
  echo "FAIL: server.url not set — hosted mode failed"
  exit 1
fi

echo ""
echo "=== Step 3: copy config into App.app ==="
if bash scripts/mac-copy-public-into-appapp.sh 2>/dev/null; then
  bash scripts/verify-hosted-app-bundle.sh
else
  echo ""
  echo "No App.app yet — open Xcode and Run once to iPhone, then re-run:"
  echo "  bash scripts/mac-native-as-webapp.sh"
  open ios/App/App.xcworkspace
  exit 1
fi

echo ""
echo "=== Step 4: reinstall on iPhone ==="
bash scripts/mac-reinstall-on-iphone.sh || bash scripts/mac-push-to-iphone.sh

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  DONE — open Restorebraine on iPhone"
echo ""
echo "  • App loads https://restorebraine.base44.app (NOT capacitor://localhost)"
echo "  • Login = exactly what you see in Safari on that URL"
echo "  • Tap Continue with Google — same flow as web"
echo ""
echo "  To go back to bundled mode later:"
echo "    bash scripts/mac-capacitor-web-sync.sh"
echo "════════════════════════════════════════════════════════════════"
