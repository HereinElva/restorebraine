#!/usr/bin/env bash
# Copy ONE file for Base44 — run each command in order. Terminal tells you what to do.
#
# Usage:
#   bash scripts/base44-copy-one.sh          # next file (tracks progress)
#   bash scripts/base44-copy-one.sh 5        # specific file number 1-38
#   bash scripts/base44-copy-one.sh --status # where you are
#   bash scripts/base44-copy-one.sh --reset  # start over at file 1
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PROGRESS=".base44-publish-progress"
DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

FILES=(
  "index.html"
  "public/native-oauth-return.js"
  "public/login-redirect.js"
  "src/main.jsx"
  "src/deploy-marker.js"
  "src/lib/app-params.js"
  "src/lib/app-domains.js"
  "src/lib/auth-urls.js"
  "src/lib/sign-in-with-provider.js"
  "src/lib/sign-in-with-google.js"
  "src/lib/AuthContext.jsx"
  "src/api/base44Client.js"
  "src/App.jsx"
  "src/screens/SignInScreen.jsx"
  "src/screens/sign-in.css"
  "src/components/NativeLoginCard.jsx"
  "src/components/SignInWithAppleButton.jsx"
  "src/components/AppleLogo.jsx"
  "public/apple-sign-in-logo.svg"
  "src/components/LoginPage.jsx"
  "src/components/LoginLogo.jsx"
  "src/lib/login-logo-data.js"
  "src/lib/native-hosted-redirect.js"
  "src/lib/native-bundle-mode.js"
  "src/lib/native-oauth-fix.js"
  "src/lib/native-platform-guard.js"
  "src/lib/native-google-oauth.js"
  "src/lib/session-bootstrap.js"
  "src/lib/app-branding.js"
  "src/components/gallery/MobileGallery.jsx"
  "src/components/gallery/folderActionStyles.js"
  "src/components/gallery/OrganizeButton.jsx"
  "src/components/gallery/CustomFolderButton.jsx"
  "src/components/gallery/DuplicateDetector.jsx"
  "src/components/ui/BrandGradientIcon.jsx"
  "src/lib/stripe-checkout.js"
  "src/components/upload/PaymentModal.jsx"
  "src/lib/folder-server-sync.js"
  "src/lib/folder-membership.js"
  "src/lib/run-media-organize.js"
  "public/native-ui-scrub.js"
  "src/Layout.jsx"
  "src/pages/Account.jsx"
  "src/index.css"
)

copy_file() {
  local f="$1"
  if [ "$f" = "src/lib/native-bundle-mode.js" ]; then
    printf '%s\n' "// Base44 hosted web — must be false" "export const LOCAL_NATIVE_BUNDLE = false;" | pbcopy
  else
    pbcopy < "$f"
  fi
}

TOTAL=${#FILES[@]}

if [ "${1:-}" = "--reset" ]; then
  rm -f "$PROGRESS"
  echo "Reset. Start at file 1:"
  echo "  bash scripts/base44-copy-one.sh"
  exit 0
fi

if [ "${1:-}" = "--status" ]; then
  n=$(cat "$PROGRESS" 2>/dev/null || echo 0)
  echo "Progress: ${n} of ${TOTAL} files done"
  if [ "$n" -lt "$TOTAL" ]; then
    echo "Next: bash scripts/base44-copy-one.sh"
  else
    echo "All copied. Click PUBLISH in Base44, then:"
    echo "  bash scripts/base44-check-live.sh"
  fi
  exit 0
fi

if [ -n "${1:-}" ] && [[ "$1" =~ ^[0-9]+$ ]]; then
  N=$1
else
  N=$(($(cat "$PROGRESS" 2>/dev/null || echo 0) + 1))
fi

if [ "$N" -lt 1 ] || [ "$N" -gt "$TOTAL" ]; then
  echo "File number must be 1-${TOTAL}"
  exit 1
fi

f="${FILES[$((N - 1))]}"
copy_file "$f"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  FILE ${N} OF ${TOTAL}  —  code is on your clipboard"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  In Base44 (Code editor):"
echo "    1. Open file:  ${f}"
echo "    2. Click inside the editor"
echo "    3. Cmd+A  (select all)"
echo "    4. Cmd+V  (paste)"
echo "    5. Save"
echo ""
if [ "$N" -eq "$TOTAL" ]; then
  echo "  >>> LAST FILE. After Save, click PUBLISH in Base44. <<<"
  echo ""
  echo "  Wait 60 seconds, then run:"
  echo "    bash scripts/base44-check-live.sh"
else
  echo "  When saved, run next file:"
  echo "    bash scripts/base44-copy-one.sh"
fi
echo ""
echo "$N" > "$PROGRESS"
