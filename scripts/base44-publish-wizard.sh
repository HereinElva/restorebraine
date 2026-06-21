#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FILES=(
  index.html
  public/login-redirect.js
  src/main.jsx
  src/deploy-marker.js
  src/lib/app-params.js
  src/lib/app-domains.js
  src/lib/auth-urls.js
  src/lib/AuthContext.jsx
  src/api/base44Client.js
  src/App.jsx
  src/lib/native-hosted-redirect.js
  src/lib/native-bundle-mode.js
  src/lib/native-oauth-fix.js
  src/lib/native-platform-guard.js
  src/lib/native-google-oauth.js
  src/lib/session-bootstrap.js
  src/lib/app-branding.js
  src/components/gallery/MobileGallery.jsx
  src/components/gallery/folderActionStyles.js
  src/components/gallery/OrganizeButton.jsx
  src/components/gallery/CustomFolderButton.jsx
  src/components/gallery/DuplicateDetector.jsx
  src/components/ui/BrandGradientIcon.jsx
  src/Layout.jsx
  src/index.css
)

DEPLOY=$(grep -o '[0-9]*' src/deploy-marker.js | head -1)
TOTAL=${#FILES[@]}

echo ""
echo "BASE44 PUBLISH WIZARD (deploy v${DEPLOY})"
echo "========================================"
echo ""
echo "This copies ONE file at a time to your clipboard."
echo "After each step: switch to Base44 Code editor, paste, save, come back here."
echo ""
read -r -p "Press Enter to start file 1 of ${TOTAL}..."

n=1
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f"
    exit 1
  fi
  pbcopy < "$f"
  echo ""
  echo "=========================================="
  echo "FILE ${n} OF ${TOTAL}"
  echo "BASE44 PATH: ${f}"
  echo "=========================================="
  echo "Clipboard ready. In Base44: open ${f} -> Cmd+A -> Cmd+V -> Save"
  echo ""
  if [[ "$n" -eq "$TOTAL" ]]; then
    read -r -p "After saving ${f}, press Enter..."
    echo ""
    echo "ALL 25 FILES DONE."
    echo "NOW click PUBLISH in Base44 (browser). Terminal cannot click Publish."
    echo "Then run: bash scripts/base44-check-live.sh"
  else
    read -r -p "Press Enter when saved in Base44 for next file..."
  fi
  n=$((n + 1))
done
