#!/usr/bin/env bash
# Fix Apple Sign In on iPhone — detects why login shows "Continue With Apple" (no logo).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
IOS_URL=$(grep -o '"url": *"[^"]*"' ios/App/App/capacitor.config.json 2>/dev/null | head -1 || echo "none")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Fix Apple login — why iPhone shows no change                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Git build: v${BUILD} · deploy v${DEPLOY}"
echo "iOS config server.url: ${IOS_URL:-bundled (no url)}"
echo ""

LIVE=$(curl -sL --max-time 12 "https://restorebraine.base44.app/?t=$(date +%s)" 2>/dev/null || echo "")
LIVE_VER=$(echo "$LIVE" | grep -oE 'content="v[0-9]+"' | head -1 | tr -d '"' || echo "unknown")
HAS_OLD=$(echo "$LIVE" | grep -qi 'Continue With Apple' && echo yes || echo no)
HAS_NEW=$(echo "$LIVE" | grep -qi 'Sign in with Apple' && echo yes || echo no)

echo "Base44 live: ${LIVE_VER} (git expects v${DEPLOY})"
echo "  Old button (Continue With Apple): ${HAS_OLD}"
echo "  New button (Sign in with Apple):  ${HAS_NEW}"
echo ""

if [ "$HAS_OLD" = "yes" ] || [ "$LIVE_VER" != "v${DEPLOY}" ]; then
  echo "████████████████████████████████████████████████████████████████"
  echo "  HOSTED BASE44 IS OLD (${LIVE_VER}) — Mac web rebuild cannot fix login"
  echo "████████████████████████████████████████████████████████████████"
  echo ""
  echo "=== FASTEST FIX (no Base44 publish) ==="
  echo ""
  echo "  A) Bundled login from Mac (best for App Store):"
  echo "     bash scripts/mac-apple-login-bundled.sh"
  echo ""
  echo "  B) Hosted + native Apple button overlay:"
  echo "     bash scripts/mac-apple-login-rebuild.sh"
  echo ""
  echo "  Then: Delete app from iPhone → Xcode Clean → Run"
  echo ""
  echo "  Native iOS injects Apple logo on \"Continue With Apple\" button."
  echo ""
  echo "=== OR publish Base44 (38 files) ==="
  echo ""
  echo "  bash scripts/base44-copy-one.sh --reset"
  echo "  bash scripts/base44-copy-one.sh   (repeat 38x) → Publish"
  echo ""
  exit 0
fi

echo "Base44 looks updated. If iPhone still wrong, rebuild bundled:"
echo ""
echo "  bash build-iphone.sh"
echo "  node scripts/verify-bundled-deploy-ready.mjs"
echo "  Delete app from iPhone → Xcode Clean → Run"
echo ""
echo "Login must show: Login v${BUILD} + Sign in with Apple + logo"
