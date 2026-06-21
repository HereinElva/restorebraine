#!/usr/bin/env bash
# ONE pipeline: build web app → merge into Capacitor ios/public → reinstall on iPhone.
# Login UI is ONLY in src/screens/SignInScreen.jsx — same dist/ for web + native bundle.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Capacitor web sync — src → dist → ios/public → iPhone       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Login is React-only (SignInScreen). Gallery/folders locked to Omega v4-core baseline."
echo "server.url must stay 0 — bundled capacitor://localhost mode."
echo "Omega reference: docs/OMEGA.md (tag omega-v4-core, deploy v80)"
echo ""

echo "=== Step 1: build:native-local (web dist + cap merge) ==="
npm run build:native-local

echo ""
echo "=== Step 2: copy ios/public → App.app (no Xcode Run needed) ==="
bash scripts/mac-copy-public-into-appapp.sh || {
  echo ""
  echo "No App.app yet — run once in Xcode (Cmd+R), then re-run this script."
  exit 1
}

echo ""
echo "=== Step 3: verify Mac bundle ==="
bash scripts/verify-xcode-app-bundle.sh

echo ""
echo "=== Step 4: reinstall on iPhone ==="
bash scripts/mac-reinstall-on-iphone.sh

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
echo ""
echo "Login must show: Google + Apple + email + Native bundle · v${BUILD_NUM}"
echo "Purple badge: v${BUILD_NUM} · v4-core · capacitor://localhost · auth: sign-in-v4"
echo ""
echo "Launch screen (logo + white title): Xcode Run after storyboard/splash changes."
echo "  open ios/App/App.xcworkspace → Product → Clean Build Folder → Run (Cmd+R)"
