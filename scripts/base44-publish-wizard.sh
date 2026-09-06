#!/usr/bin/env bash
# Base44 publish — one file at a time (no giant txt file to scroll).
#
# Usage:
#   bash scripts/base44-publish-wizard.sh           # start from file 1
#   bash scripts/base44-publish-wizard.sh 12        # resume at file 12
#   bash scripts/base44-publish-wizard.sh --list    # show checklist only
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

FILES=(
  "index.html"
  "public/native-oauth-return.js"
  "public/login-redirect.js"
  "src/main.jsx"
  "public/stripe-native-guard.js"
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
  "src/lib/native-platform.js"
  "src/lib/stripe-checkout.js"
  "src/components/upload/PaymentModal.jsx"
  "src/pages/PaymentSuccess.jsx"
  "src/components/gallery/MobileGallery.jsx"
  "src/components/gallery/folderActionStyles.js"
  "src/components/gallery/OrganizeButton.jsx"
  "src/components/gallery/CustomFolderButton.jsx"
  "src/components/gallery/DuplicateDetector.jsx"
  "src/components/ui/BrandGradientIcon.jsx"
  "src/lib/folder-server-sync.js"
  "src/lib/folder-membership.js"
  "src/lib/run-media-organize.js"
  "public/native-ui-scrub.js"
  "public/hosted-runtime-guard.js"
  "src/Layout.jsx"
  "src/pages/Account.jsx"
  "src/components/RuntimeDiagnostic.jsx"
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

if [ "${1:-}" = "--list" ] || [ "${1:-}" = "-l" ]; then
  echo "Base44 publish checklist (v${DEPLOY}) — ${#FILES[@]} files"
  echo ""
  n=1
  for f in "${FILES[@]}"; do
    printf '%2d. %s\n' "$n" "$f"
    n=$((n + 1))
  done
  echo ""
  echo "Run: bash scripts/base44-publish-wizard.sh"
  exit 0
fi

START="${1:-1}"
if ! [[ "$START" =~ ^[0-9]+$ ]] || [ "$START" -lt 1 ] || [ "$START" -gt "${#FILES[@]}" ]; then
  echo "Usage: bash scripts/base44-publish-wizard.sh [start-number|--list]"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Base44 Publish Wizard — v${DEPLOY} (one file at a time)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Before you start:"
echo "  1. Open Base44 → Restorebraine → Code editor (keep it open)"
echo "  2. Do NOT click Publish until all ${#FILES[@]} files are saved"
echo ""
echo "Each step:"
echo "  • Terminal copies the file for you"
echo "  • In Base44: open the path → Select All → Paste → Save"
echo "  • Come back to Terminal → press Enter for the next file"
echo ""
read -r -p "Ready? (y/N) " READY
if [[ ! "$READY" =~ ^[Yy]$ ]]; then
  echo "Run again when ready: bash scripts/base44-publish-wizard.sh"
  exit 0
fi

TOTAL=${#FILES[@]}
idx=$((START - 1))

while [ "$idx" -lt "$TOTAL" ]; do
  n=$((idx + 1))
  f="${FILES[$idx]}"
  part=""
  if [ "$n" -le 12 ]; then part="Part 1 — boot + auth"
  elif [ "$n" -le 24 ]; then part="Part 2 — OAuth + session"
  else part="Part 3 — gallery + layout (last)"
  fi

  copy_file "$f"

  echo ""
  echo "────────────────────────────────────────────────────────────"
  echo "  FILE ${n} of ${TOTAL}  ·  ${part}"
  echo "────────────────────────────────────────────────────────────"
  echo ""
  echo "  In Base44 Code editor, open:"
  echo ""
  echo "      ${f}"
  echo ""
  echo "  Then:  Select All  →  Paste  →  Save"
  echo "  (code is already on your clipboard)"
  echo ""

  if [ "$n" -eq "$TOTAL" ]; then
    echo "  >>> This is the LAST file. After Save, click PUBLISH in Base44. <<<"
    read -r -p "Saved ${f}? Press Enter to finish…" _
    break
  fi

  read -r -p "Saved ${f}? Press Enter for next file (or type s to stop)… " NEXT
  if [[ "$NEXT" =~ ^[Ss]$ ]]; then
    echo ""
    echo "Stopped at file ${n}. Resume with:"
    echo "  bash scripts/base44-publish-wizard.sh $((n + 1))"
    exit 0
  fi

  idx=$((idx + 1))
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ALL ${TOTAL} FILES DONE — click PUBLISH in Base44 now"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Verify in Terminal:"
echo "  node scripts/verify-base44-live.mjs"
echo ""
echo "Verify in Safari (private tab):"
echo "  https://restorebraine.base44.app"
echo "  • Google + Apple + Microsoft + email login"
echo "  • View Source: restorebraine-deploy content=\"v${DEPLOY}\""
echo ""
echo "Then Capacitor native shell (Terminal):"
echo "  bash scripts/mac-complete-rebuild.sh"
echo "Then Xcode: Delete app → Clean → Run → Restorebraine DEPLOY OK"
echo ""
