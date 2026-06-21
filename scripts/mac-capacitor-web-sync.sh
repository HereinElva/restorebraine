#!/usr/bin/env bash
# ONE pipeline: build web app → merge into Capacitor ios/public → reinstall on iPhone.
# Login UI is ONLY in src/screens/SignInScreen.jsx — same dist/ for web + native bundle.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Capacitor web sync — src → dist → ios/public → iPhone       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Login is React-only (SignInScreen). No duplicate preboot HTML."
echo "server.url must stay 0 — bundled capacitor://localhost mode."
echo ""

echo "=== Step 1: build:native-local (web dist + cap merge) ==="
npm run build:native-local

echo ""
echo "=== Step 2: verify Mac bundle ==="
bash scripts/verify-xcode-app-bundle.sh || {
  echo ""
  echo "No Xcode App.app yet — build once in Xcode (Cmd+R) or continue to push if App.app exists."
}

echo ""
echo "=== Step 3: reinstall on iPhone ==="
bash scripts/mac-reinstall-on-iphone.sh

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
echo ""
echo "Login must show: Restorebraine + Continue with Google + Native bundle · v${BUILD_NUM}"
echo "Purple badge: v${BUILD_NUM} · v4-core · capacitor://localhost · auth: sign-in-v4"
