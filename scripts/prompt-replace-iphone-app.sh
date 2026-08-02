#!/usr/bin/env bash
# Blocking confirmation: iPhone app must be FULLY REPLACED (delete + restart),
# not just updated via Xcode Run. Required before/after v87 rebuild commands.
#
# Usage:
#   bash scripts/prompt-replace-iphone-app.sh --before-rebuild
#   bash scripts/prompt-replace-iphone-app.sh --before-xcode
#   npm run prompt:replace-app
#
# Skip (non-interactive / already done):
#   REPLACE_APP_CONFIRMED=1 npm run reset:v87-all
#   npm run prompt:replace-app -- --yes
set -euo pipefail

PHASE="before-xcode"
SKIP=0

for arg in "$@"; do
  case "$arg" in
    --before-rebuild) PHASE="before-rebuild" ;;
    --before-xcode) PHASE="before-xcode" ;;
    --after-align) PHASE="after-align" ;;
    --yes|--yes-replace-app) SKIP=1 ;;
    -h|--help)
      cat << 'EOF'
Usage: bash scripts/prompt-replace-iphone-app.sh [--before-rebuild|--before-xcode|--after-align] [--yes]

iPhone MUST be fully replaced — not updated in place:
  1. Delete Restorebraine from iPhone home screen (long-press → Remove App → Delete App)
  2. Restart iPhone (hold power → slide to power off → turn back on)
  3. Only THEN: Xcode → Clean Build Folder → Run (installs fresh app)

Skip prompt: REPLACE_APP_CONFIRMED=1  or  --yes
EOF
      exit 0
      ;;
  esac
done

if [[ "${REPLACE_APP_CONFIRMED:-}" == "1" ]] || [[ "$SKIP" == "1" ]]; then
  echo "✓ iPhone app replace acknowledged (skip flag)"
  exit 0
fi

echo
echo "══════════════════════════════════════════════════════════════"
echo " REQUIRED: REPLACE THE IPHONE APP ALTOGETHER"
echo "══════════════════════════════════════════════════════════════"
echo

case "$PHASE" in
  before-rebuild)
    echo " Before rebuilding GitHub + Capacitor back to v87, wipe the phone install."
    echo " Xcode Run alone does NOT replace cached WKWebView JS or old sessions."
    ;;
  before-xcode|after-align)
    echo " All Mac layers are aligned. Before Xcode Run, replace the app on iPhone."
    echo " Updating in place keeps stale WKWebView cache → \"no change\" on UI fixes."
    ;;
esac

echo
echo " On your iPhone, do ALL of these steps:"
echo
echo "   1. DELETE Restorebraine completely"
echo "      Home screen → long-press Restorebraine → Remove App → Delete App"
echo "      (NOT \"Offload App\" — must be Delete App)"
echo
echo "   2. RESTART iPhone"
echo "      Power off completely, wait 10 seconds, power back on"
echo "      (Clears WKWebView website data that survives delete)"
echo
echo "   3. THEN in Xcode (after this prompt):"
echo "      Product → Clean Build Folder → Run on iPhone"
echo "      (This installs a fresh app — do not tap an old icon)"
echo
echo " Why: Hosted Capacitor loads live Base44 JS. Old app cache + session"
echo "       makes gallery/CSS/OAuth fixes look like they \"didn't work\"."
echo
echo "══════════════════════════════════════════════════════════════"

if [[ ! -t 0 ]]; then
  echo
  echo "✗ Non-interactive terminal — cannot confirm iPhone app replace."
  echo "  Do steps 1–2 on iPhone, then re-run with:"
  echo "    REPLACE_APP_CONFIRMED=1 npm run <command>"
  exit 1
fi

echo
read -r -p "Type YES after you DELETED the app and RESTARTED iPhone: " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
  echo
  echo "✗ Stopped — replace the app on iPhone first (Delete App + Restart)."
  echo "  Re-run this command when done."
  exit 1
fi

echo
echo "✓ Confirmed — proceed with v87 rebuild / Xcode Clean → Run"
echo
