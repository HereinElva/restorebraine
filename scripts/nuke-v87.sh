#!/usr/bin/env bash
# Nuke post-v87 lingering builds on GitHub + Capacitor (Mac).
# Base44 live JS must be wiped separately via browser Publish — see base44:nuke-list
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${1:-cursor/apple-privacy-plist-bacf}"
V87_TAG="${NUKE_V87_TAG:-v87-baseline}"
V87_COMMIT="${NUKE_V87_COMMIT:-f1b2505}"

echo "══════════════════════════════════════════════════════════════"
echo " v87 NUKE — GitHub + Capacitor wipe (post-v87 artifacts)"
echo " Target: ${V87_TAG} (${V87_COMMIT})"
echo " Branch: origin/${BRANCH} (diagnostic scripts after v87 tip)"
echo " Base44: NOT touched by this script — run base44:nuke-list next"
echo "══════════════════════════════════════════════════════════════"
echo

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run from restorebraine repo root."
  exit 1
fi

echo "==> [1/7] Fetch origin"
git fetch origin "$BRANCH" --tags

echo "==> [2/7] Hard reset to origin/${BRANCH} (v87 app + diagnostic scripts)"
git reset --hard "origin/${BRANCH}"

echo "==> [3/7] Verify app source matches v87 tip ${V87_COMMIT}"
if ! node scripts/verify-v87-baseline.mjs; then
  echo "ERROR: branch app source is not v87-clean."
  echo "       Try: git reset --hard ${V87_COMMIT}"
  exit 1
fi

echo "==> [4/7] Wipe Capacitor / npm build debris (post-v87 bundled leftovers)"
git clean -fd -- \
  dist \
  ios/App/App/public \
  ios/App/build \
  node_modules/.vite \
  2>/dev/null || true
rm -rf ios/App/Pods ios/App/Podfile.lock 2>/dev/null || true

echo "==> [5/7] Force hosted Capacitor (never bundled appStartPath)"
node scripts/use-local-native-bundle.mjs --hosted
if grep -q 'appStartPath' capacitor.config.json 2>/dev/null; then
  echo "ERROR: appStartPath found — post-v87 bundled mode not fully erased."
  exit 1
fi

echo "==> [6/7] Xcode DerivedData + WebKit cache (Mac only)"
if [[ "$(uname -s)" == "Darwin" ]]; then
  DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
  if [[ -d "$DERIVED" ]]; then
    find "$DERIVED" -maxdepth 1 -type d \( -name 'App-*' -o -name '*restorebraine*' -o -name '*Restorebraine*' \) \
      -print -exec rm -rf {} + 2>/dev/null || true
    echo "    Cleared Xcode DerivedData"
  fi
  # WKWebView website data (helps when re-testing before delete-app)
  rm -rf ~/Library/Caches/com.apple.WebKit 2>/dev/null || true
  rm -rf ~/Library/WebKit 2>/dev/null || true
  echo "    Cleared WebKit caches"
else
  echo "    (skip DerivedData — not on macOS)"
fi

echo "==> [7/7] Rebuild hosted Capacitor shell (v87 OAuth in ios/public fallback)"
npm install
bash scripts/mac-ios-setup.sh "$BRANCH"

echo
echo "==> Scan for post-v87 lingering artifacts"
node scripts/verify-no-post-v87-lingering.mjs --strict || true

echo
echo "══════════════════════════════════════════════════════════════"
echo " GITHUB + CAPACITOR NUKE COMPLETE"
echo "══════════════════════════════════════════════════════════════"
echo
echo " NEXT — wipe live Base44 (required for Sign In on phone):"
echo "   npm run base44:nuke-list"
echo "   → paste ALL files in Base44 editor → Publish"
echo
echo " VERIFY all three layers:"
echo "   npm run verify:lingering -- --strict"
echo "   npm run diagnose:all"
echo "   npm run diagnose:watch   (optional — while Publishing)"
echo
echo " iPhone (after Base44 Publish passes diagnose):"
echo "   Delete app → Restart iPhone → Xcode Clean → Run"
echo
echo " DO NOT USE (re-introduces post-v87 regressions):"
echo "   npm run build:native-local"
echo "   bash scripts/mac-ios-setup.sh --bundled"
echo "   Any NativeLoginCard / SignInScreen / LoginPage experiments"
echo "══════════════════════════════════════════════════════════════"
