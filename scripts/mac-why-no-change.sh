#!/usr/bin/env bash
# Why don't fixes show on iPhone? (hosted + bundled aware)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — why no change?                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')
URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo '')
HOSTED=0
if [[ "$URL" == *"restorebraine.base44.app"* ]]; then HOSTED=1; fi

echo "1) Mac repo"
echo "   BUILD_NUMBER: v${BUILD}"
echo "   DEPLOY_BUILD: v${DEPLOY}"
if [ "$HOSTED" = "1" ]; then
  echo "   Mode:           HOSTED — UI from live Base44 (Publish required)"
  echo "   server.url:     ${URL}"
else
  ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo 'missing')
  echo "   Mode:           BUNDLED — UI from ios/public on device"
  echo "   Entry JS:       ${ENTRY}"
fi
echo ""

echo "2) Live Base44 (hosted apps load this at runtime)"
LIVE=$(curl -sL --max-time 8 'https://restorebraine.base44.app/' 2>/dev/null | grep -oE 'content="v[0-9]+"' | head -1 | tr -d '"' || echo 'unknown')
echo "   Live deploy:    ${LIVE:-unknown}"
echo "   Git expects:    v${DEPLOY}"
if [ "$HOSTED" = "1" ] && [ "${LIVE#content=}" != "v${DEPLOY}" ] 2>/dev/null; then
  echo "   → Base44 Publish required: bash scripts/base44-publish-wizard.sh"
fi
echo ""

echo "3) Xcode signing (required to install native shell on iPhone)"
XCODE_TEAMS=$(bash scripts/mac-list-xcode-account-teams.sh --ids-only 2>/dev/null || true)
if [ -n "$XCODE_TEAMS" ]; then
  echo "   Apple ID in Xcode: YES"
else
  echo "   Apple ID in Xcode: NO — Product → Run cannot install until you sign in"
fi
echo ""

echo "4) Did Xcode build App.app on this Mac?"
APP=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*-iphoneos/*' 2>/dev/null | grep -v Index.noindex | head -1)
if [ -n "$APP" ] && [ -f "$APP/BUILD_STAMP.txt" ]; then
  echo "   Found: $APP"
  echo "   BUILD_STAMP: $(cat "$APP/BUILD_STAMP.txt" 2>/dev/null | head -1)"
else
  echo "   No device App.app — Xcode Run to iPhone never succeeded"
fi
echo ""

echo "5) Full scenario audit (repo + live)"
node scripts/audit-capacitor-sync-scenarios.mjs 2>/dev/null || echo "   (run: node scripts/audit-capacitor-sync-scenarios.mjs)"
echo ""

echo "══════════════════════════════════════════════════════════════"
if [ "$HOSTED" = "1" ]; then
  echo "HOSTED: fixes need Base44 Publish AND a fresh Xcode Run install."
  echo "  bash scripts/base44-publish-wizard.sh → Publish"
  echo "  bash scripts/mac-build.sh --no-git → delete app → Xcode Clean → Run"
  echo "Purple overlay (top-right): shell https://restorebraine.base44.app"
else
  echo "BUNDLED: fixes need mac-build.sh --bundled and Xcode Run only."
  echo "Purple badge should show capacitor://localhost"
fi
echo "Also run: bash scripts/mac-diagnose-mobile.sh"
echo "══════════════════════════════════════════════════════════════"
