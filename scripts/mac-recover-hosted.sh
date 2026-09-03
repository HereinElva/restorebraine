#!/usr/bin/env bash
# Recover from git pull failures + accidental bundled builds.
# Resets Mac repo to GitHub, then builds HOSTED shell (Base44 live UI).
#
# Usage:
#   bash scripts/mac-recover-hosted.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Recover hosted build — sync GitHub + rebuild shell          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "This fixes:"
echo "  • git pull blocked by src/lib/build-info.js"
echo "  • accidental bundled (capacitor://localhost) instead of hosted"
echo "  • version drift from write-build-info.mjs (e.g. v296 vs Base44 v295)"
echo ""

exec bash scripts/mac-complete-rebuild.sh "$@"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  NEXT — Xcode only (do not re-run mac-build in Terminal)"
echo "════════════════════════════════════════════════════════════════"
echo "  1. Delete Restorebraine from iPhone"
echo "  2. open ios/App/App.xcworkspace"
echo "  3. Select your iPhone (not Simulator)"
echo "  4. Product → Clean Build Folder"
echo "  5. Product → Run (Cmd+R)"
echo "  6. Build log MUST show: Restorebraine DEPLOY OK"
echo "  7. bash scripts/verify-xcode-app-bundle.sh"
echo "  8. bash scripts/verify-hosted-app-bundle.sh"
echo ""
echo "Purple overlay top-right must say: shell https://restorebraine.base44.app"
echo "NOT capacitor://localhost"
echo ""
