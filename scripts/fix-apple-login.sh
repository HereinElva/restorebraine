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
  echo "  YOUR IPHONE APP LOADS BASE44 — NOT YOUR MAC BUNDLE"
  echo "████████████████████████████████████████████████████████████████"
  echo ""
  echo "Mac rebuild (Option A) cannot change login until Base44 is published."
  echo "The publish wizard was missing Apple button files — now fixed."
  echo ""
  echo "=== DO THIS (15 min) ==="
  echo ""
  echo "  1. node scripts/generate-base44-publish.mjs"
  echo "  2. bash scripts/base44-copy-one.sh --reset"
  echo "  3. bash scripts/base44-copy-one.sh   (repeat until last file)"
  echo "  4. Click PUBLISH in Base44"
  echo "  5. bash scripts/base44-check-live.sh   (must PASS)"
  echo "  6. bash build-iphone.sh --hosted"
  echo "  7. Xcode Clean → Run on iPhone"
  echo ""
  echo "After fix, login shows: Login v${BUILD} + Sign in with Apple + white logo"
  echo ""
  node scripts/generate-base44-publish.mjs 2>/dev/null | tail -3 || true
  exit 0
fi

echo "Base44 looks updated. If iPhone still wrong, rebuild bundled:"
echo ""
echo "  bash build-iphone.sh"
echo "  node scripts/verify-bundled-deploy-ready.mjs"
echo "  Delete app from iPhone → Xcode Clean → Run"
echo ""
echo "Login must show: Login v${BUILD} + Sign in with Apple + logo"
