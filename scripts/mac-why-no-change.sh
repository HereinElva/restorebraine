#!/usr/bin/env bash
# Why don't I see v154 / new login on iPhone or web?
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — why no change?                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo 'missing')
URL_COUNT=$(grep -c 'server.url' ios/App/App/capacitor.config.json 2>/dev/null || echo 0)

echo "1) Mac repo bundle (what SHOULD be on iPhone):"
echo "   BUILD_NUMBER:     v${BUILD}"
echo "   Entry JS:         ${ENTRY}"
echo "   server.url count: ${URL_COUNT} (must be 0 for bundled app)"
if [ -f ios/App/App/public/index.html ]; then
  echo "   Status:           OK — bundle built on this Mac"
else
  echo "   Status:           MISSING — run: bash scripts/mac-ios-v4-deploy.sh --no-sync"
fi
echo ""

echo "2) Xcode signing (required to put bundle ON iPhone):"
XCODE_TEAMS=$(bash scripts/mac-list-xcode-account-teams.sh --ids-only 2>/dev/null || true)
if [ -n "$XCODE_TEAMS" ]; then
  echo "   Apple ID in Xcode: YES"
  echo "$XCODE_TEAMS" | while read -r t; do echo "     team $t"; done
else
  echo "   Apple ID in Xcode: NO ← THIS IS WHY IPHONE SHOWS NO CHANGE"
  echo ""
  echo "   Opening the .xcworkspace does NOT install the app."
  echo "   CLI install fails until you sign in:"
  echo "     Xcode menu → Settings → Accounts → + → Apple ID"
  echo "   Then: Product → Run (Cmd+R) with your iPhone selected"
fi
echo ""

echo "3) Did Xcode ever build App.app on this Mac?"
APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' 2>/dev/null | grep -v Index.noindex | head -1)
if [ -n "$APP" ] && [ -f "$APP/public/index.html" ]; then
  APP_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "$APP/public/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo '?')
  APP_STAMP=$(cat "$APP/BUILD_STAMP.txt" 2>/dev/null | head -1 || echo '?')
  echo "   Found: $APP"
  echo "   Built entry JS: $APP_ENTRY"
  echo "   BUILD_STAMP:      $APP_STAMP"
  if [ "$APP_ENTRY" = "$ENTRY" ]; then
    echo "   Status: Xcode built matching bundle — but iPhone may not have it if Run failed"
  else
    echo "   Status: STALE — Xcode build ≠ repo. Clean Build Folder → Run again"
  fi
else
  echo "   No device App.app found — Xcode Run to iPhone never succeeded"
fi
echo ""

echo "4) Live website (restorebraine.com) — separate from iPhone bundle:"
LIVE=$(curl -sL --max-time 8 'https://restorebraine.com' 2>/dev/null | grep -o 'content="v[0-9]*"' | head -1 | tr -d '"' || echo 'unknown')
echo "   Live deploy marker: ${LIVE:-unknown}"
echo "   Git has:            v${BUILD}"
if [ "${LIVE#content=}" != "v${BUILD}" ] 2>/dev/null; then
  echo "   Website unchanged until Base44 Publish (base44-publish-v${BUILD}.txt)"
fi
echo ""

echo "══════════════════════════════════════════════════════════════"
if [ -z "$XCODE_TEAMS" ]; then
  echo "BOTTOM LINE: v${BUILD} is on your Mac but NOT on your iPhone."
  echo "Sign into Xcode → Accounts, then Product → Run to your iPhone."
else
  echo "BOTTOM LINE: Sign in OK. In Xcode: select iPhone → Clean → Run."
  echo "Build log must show: Restorebraine DEPLOY OK"
fi
echo "On iPhone login screen:"
echo "  OLD (hosted Base44 not updated): Continue With Apple — no logo"
echo "  NEW (bundled v${BUILD}+):         Sign in with Apple + logo · Build v${BUILD} at bottom"
echo "On iPhone tap purple badge: must say v${BUILD} · v4-core · capacitor://localhost"
echo "══════════════════════════════════════════════════════════════"
