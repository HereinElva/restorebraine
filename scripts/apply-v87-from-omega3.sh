#!/usr/bin/env bash
# apply-v87-from-omega3.sh — Omega 3 gallery reference + all v87 corrections, bundled on iPhone
#
# Keeps terminal control (capacitor://localhost) like omega-3, but app source is v87:
#   privacy plist, AI consent, native-media-input, SignedOutLanding, OAuth URL fix
#
# Usage:
#   npm run apply:v87-from-omega3
#   npm run apply:v87-from-omega3 -- --no-open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPEN_XCODE=1
for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_XCODE=0 ;;
    -h|--help)
      cat << 'EOF'
Apply v87 on top of Omega 3 — bundled iPhone UI from Mac (no Base44 Publish required)

  npm run apply:v87-from-omega3

Includes these corrections since omega-3 (f58a80d):
  17af6de  App Store privacy plist (5.1.1)
  6c15e97  v82 compact AI consent + fast upload
  390928b  v83 native-media-input for iOS upload picker
  698975e  Hosted OAuth/session fixes (bundled build strips server.url)
  5762b16  v87 UI — SignedOutLanding
  f1b2505  OAuth on restorebraine.base44.app

After: Xcode → Delete app → Clean Build Folder → Run
EOF
      exit 0
      ;;
  esac
done

echo
echo "══════════════════════════════════════════════════════════════"
echo " APPLY v87 FROM OMEGA 3 — bundled (terminal-controlled UI)"
echo "══════════════════════════════════════════════════════════════"
echo
echo " Omega 3 gallery/organize reference  →  kept in git through v87"
echo " v87 login/UI/OAuth/upload fixes     →  applied from branch tip"
echo " Phone loads                         →  capacitor:// bundled ios/public"
echo " Base44 Publish                      →  NOT required for this mode"
echo

OPEN_XCODE="$OPEN_XCODE" TERMINAL_REVERT_MODE=bundled-v87 bash scripts/terminal-revert-all.sh --bundled-v87 --no-open

echo
echo "==> Final audit summary"
node scripts/audit-v87-improvements.mjs

echo
echo "══════════════════════════════════════════════════════════════"
echo " NEXT: Xcode → Delete app on iPhone → Clean Build Folder → Run"
echo "══════════════════════════════════════════════════════════════"

if [[ "$OPEN_XCODE" == "1" && "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || true
fi
