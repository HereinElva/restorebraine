#!/usr/bin/env bash
# Print every Base44 publish path + Mac pbcopy command (run from repo root).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Restorebraine Base44 Publish — copy/paste guide (v${DEPLOY})     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "1. Open Base44 → Restorebraine app → Code editor"
echo "2. For EACH file below:"
echo "   a) Run the pbcopy command in Terminal (copies file to clipboard)"
echo "   b) In Base44, open the BASE44 PATH → Select All → Paste → Save"
echo "3. After ALL files saved → click Publish once"
echo ""
echo "Or open base44-publish-v${DEPLOY}.txt in this repo for full code blocks."
echo ""

FILES=(
  "index.html"
  "public/login-redirect.js"
  "src/main.jsx"
  "src/deploy-marker.js"
  "src/lib/app-params.js"
  "src/lib/app-domains.js"
  "src/lib/auth-urls.js"
  "src/lib/sign-in-with-google.js"
  "src/lib/AuthContext.jsx"
  "src/api/base44Client.js"
  "src/App.jsx"
  "src/screens/SignInScreen.jsx"
  "src/screens/sign-in.css"
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
  "src/Layout.jsx"
  "src/index.css"
)

n=1
for f in "${FILES[@]}"; do
  printf '%2d. BASE44 PATH: %s\n' "$n" "$f"
  if [ "$f" = "src/lib/native-bundle-mode.js" ]; then
    echo '    Terminal:  printf "%s\n" "// Base44 hosted web — must be false" "export const LOCAL_NATIVE_BUNDLE = false;" | pbcopy'
  else
    echo "    Terminal:  pbcopy < \"$f\""
  fi
  echo ""
  n=$((n + 1))
done

echo ">>> After all ${#FILES[@]} files saved: click PUBLISH in Base44 <<<"
echo ""
echo "Verify: Private Safari tab → https://restorebraine.com"
echo "  • Restorebraine title + Continue with Google (NOT \"Sign in to access your memories\")"
echo ""
echo "Then iOS native (Step 2):"
echo "  bash scripts/mac-ios-v4-deploy.sh"
