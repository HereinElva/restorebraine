#!/usr/bin/env bash
# Print strings to verify IN Base44 Code editor BEFORE clicking Publish.
# If editor content matches but live CDN does not after Publish → Base44 platform issue.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DEPLOY=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Base44 EDITOR checklist — verify BEFORE Publish             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "In Base44 Code editor, open each file and search (Cmd+F):"
echo ""

check_file() {
  local path="$1"
  local needle="$2"
  local label="$3"
  if grep -qF "$needle" "$path" 2>/dev/null; then
    echo "  OK git: $path"
  else
    echo "  FAIL git missing: $path — pull latest branch first"
  fi
  echo "       Search in Base44 editor for: $label"
  echo "       Expected string: $needle"
  echo ""
}

check_file index.html 'return openInApp(u);}var a=Location' \
  'return openInApp(u)  (NOT openInApp(u);return true)'

check_file public/hosted-runtime-guard.js 'rbHostedRuntimeGuard' \
  'rbHostedRuntimeGuard'

check_file src/pages/Account.jsx 'RuntimeDiagnostic' \
  'RuntimeDiagnostic import'

check_file src/components/RuntimeDiagnostic.jsx 'Runtime diagnostic' \
  'Runtime diagnostic'

echo "After all 4 match in Base44 editor:"
echo "  1. Save each file"
echo "  2. Click PUBLISH (top of Base44 app — wait for build to finish)"
echo "  3. Wait 60 seconds"
echo "  4. bash scripts/verify-base44-publish-applied.sh"
echo ""
echo "Live CDN must change. If editor OK but verify still FAIL:"
echo "  • Publish may have errored — check Base44 build log / notifications"
echo "  • Wrong Base44 app open — must be Restorebraine (68fdc5f42768c4d045fe1bac)"
echo "  • Contact Base44 support — Save works but CDN not updating"
echo ""
echo "Do NOT run mac-complete-rebuild.sh — Mac/Capacitor already OK at v${DEPLOY}."
