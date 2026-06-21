#!/usr/bin/env bash
# Fix the two most common Xcode Run blockers on Mac.
#
#   bash scripts/mac-fix-before-run.sh
#
# 1. ios/App/App/public/index.html missing → runs build-iphone.sh
# 2. No Apple ID / provisioning profile → prints signing steps
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine — fix before Xcode Run                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

NEED_BUILD=0
if [ ! -f ios/App/App/public/index.html ]; then
  echo "✗ ios/App/App/public/index.html MISSING"
  echo "  Xcode cannot build until the web bundle exists."
  NEED_BUILD=1
else
  ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//' || echo '?')
  DEPLOY=$(grep -o 'content="v[0-9]*"' ios/App/App/public/index.html | head -1 | tr -d '"' | sed 's/content=//' || echo '?')
  echo "✓ Web bundle OK — ${DEPLOY} · ${ENTRY}"
fi
echo ""

if [ "$NEED_BUILD" = "1" ]; then
  echo "=== Building web bundle (Step 3 of mac-build) ==="
  echo ""
  bash build-iphone.sh --no-git
  echo ""
fi

echo "=== Signing check ==="
echo ""
if bash scripts/mac-check-signing.sh; then
  SIGN_OK=1
else
  SIGN_OK=0
fi
echo ""

if [ "$SIGN_OK" = "0" ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  FIX SIGNING IN XCODE (required for iPhone)                  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "  1. Xcode menu → Settings… → Accounts"
  echo "  2. Click + → Apple ID → sign in"
  echo "     (Use the Apple ID for team V378L53XQP, or your own developer account)"
  echo ""
  echo "  3. Open workspace → select App target → Signing & Capabilities"
  echo "  4. ✓ Automatically manage signing"
  echo "  5. Team → pick the account you signed in with"
  echo ""
  echo "  Then: delete app from iPhone → Clean Build Folder → Run"
  echo ""
  bash scripts/mac-open-xcode-accounts.sh 2>/dev/null || open -a Xcode
else
  echo "✓ Signing looks OK — open Xcode and Run to your iPhone"
fi

echo ""
echo "Opening ios/App/App.xcworkspace ..."
open ios/App/App.xcworkspace 2>/dev/null || true
