#!/usr/bin/env bash
# Exact workflow: build on Mac → delete app → Clean → Run (no Archive yet).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUILD=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js | sed 's/.*= //;s/;//')

cat <<EOF
╔══════════════════════════════════════════════════════════════╗
║  Xcode Run checklist — Apple login fix (v${BUILD})           ║
╚══════════════════════════════════════════════════════════════╝

You said: delete app → Clean Build Folder → Run (no Archive yet).
That is correct — BUT you must run the Mac build script FIRST.

EOF

echo "=== Step 1 — Mac Terminal (before Xcode) ==="
echo ""
echo "  git pull origin cursor/fix-apple-sign-in-bacf"
echo "  bash scripts/mac-apple-login-bundled.sh --no-git"
echo ""
echo "  Must end with: READY — now Xcode Clean → Run"
echo "  If you skip this, Xcode Run installs OLD login from Base44 v162."
echo ""

if [ -f ios/App/App/public/index.html ]; then
  ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//' || echo '?')
  URL=$(grep -c '"url"' ios/App/App/capacitor.config.json 2>/dev/null || echo 0)
  STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
  echo "=== Current Mac bundle ==="
  echo "  BUILD_STAMP: ${STAMP}"
  echo "  entry JS:    ${ENTRY}"
  echo "  server.url:  ${URL} (0 = bundled, 1 = hosted Base44)"
  if rg -q "Sign in with Apple" ios/App/App/public/assets/*.js 2>/dev/null; then
    echo "  Apple label: Sign in with Apple ✓"
  else
    echo "  Apple label: MISSING — run mac-apple-login-bundled.sh"
  fi
  echo ""
else
  echo "=== WARN: ios/App/App/public missing ==="
  echo "  Run: bash scripts/mac-apple-login-bundled.sh"
  echo ""
fi

cat <<EOF
=== Step 2 — iPhone ===
  Delete Restorebraine (long-press → Remove App)

=== Step 3 — Xcode ===
  1. open ios/App/App.xcworkspace
  2. Select YOUR iPhone (not Simulator unless testing there)
  3. Product → Clean Build Folder (Shift+Cmd+K)
  4. Product → Run (Cmd+R)

=== Step 4 — Check build log (Cmd+9 → latest build) ===
  Search for:
    Restorebraine DEPLOY OK
    RestorebraineAppleLoginOverlay.swift

=== Step 5 — On login screen (bundled build) ===
  PASS: Sign in with Apple + logo (no Login v / Build v banners)
  FAIL: "Continue With Apple" only → Step 1 was skipped or Run failed

After Run works, then Archive for TestFlight.

EOF
