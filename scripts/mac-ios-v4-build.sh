#!/usr/bin/env bash
# Build v4 web bundle into ios/App/App/public from the CURRENT checkout.
# Does NOT git reset, does NOT install to iPhone — use mac-ios-v4-install.sh for that.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Restorebraine v4 BUILD (current tree) ==="
echo "Commit: $(git rev-parse --short HEAD) · branch: $(git branch --show-current)"
echo ""
echo "NOTE: npm build only updates ios/App/App/public in the repo."
echo "      Your iPhone is NOT updated until mac-ios-v4-install.sh or Xcode Run."
echo ""

echo "Force-cleaning ios/App/App/public (stale copies cause 'no change' on device)..."
rm -rf ios/App/App/public
mkdir -p ios/App/App/public/assets

bash scripts/mac-discard-build-files.sh 2>/dev/null || true

echo "Running npm run build:native-local ..."
npm run build:native-local

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')
ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//')
URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json || true)

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  BUNDLE BUILT: v${BUILD_NUM} · ${ENTRY}"
echo "  server.url count: ${URL_COUNT} (must be 0 for v4-core)"
echo "════════════════════════════════════════════════════════════════"
echo ""
if [[ "$URL_COUNT" != "0" ]]; then
  echo "ERROR: server.url is set — device will load hosted Base44 login, NOT v4 card."
  echo "       Run: node scripts/use-local-native-bundle.mjs --local && npm run build:native-local"
  exit 1
fi
echo "Next: bash scripts/mac-ios-v4-install.sh"
echo "  or: bash scripts/mac-ios-v4-deploy.sh (build + install)"
