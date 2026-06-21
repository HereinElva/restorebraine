#!/usr/bin/env bash
# Reconstruct App Store Connect build 1.0.1 (3) architecture for a NEW upload.
#
# Reference: docs/APPSTORE-BUILD-1.0.1-3.md
# Git tag:   appstore-1.0.1-build3 (commit 456770c, uploaded Jun 9 2026)
#
# That build worked because the iPhone app loaded LIVE restorebraine.base44.app —
# NOT bundled capacitor://localhost. This script restores that hosted shell.
#
# Usage:
#   bash scripts/mac-reconstruct-appstore.sh
#   SKIP_PUBLISH_CHECK=1 bash scripts/mac-reconstruct-appstore.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Reconstruct App Store 1.0.1 (3) — hosted WebView shell      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Reference build (Jun 9 2026):"
echo "  • Version 1.0.1, Apple build number 3"
echo "  • server.url → https://restorebraine.base44.app"
echo "  • Git: appstore-1.0.1-build3 (456770c)"
echo ""
echo "Your new upload will use build 179+ (Apple requires incrementing)."
echo "We are matching the ARCHITECTURE, not the old build number."
echo ""

REF=$(git rev-parse appstore-1.0.1-build3 2>/dev/null || echo "456770c")
REF_URL=$(git show "$REF:ios/App/App/capacitor.config.json" 2>/dev/null | grep -o '"url": *"[^"]*"' | head -1 || echo '"url": "https://restorebraine.base44.app"')
echo "Reference config at $REF: $REF_URL"
echo ""

export SKIP_PUBLISH_CHECK="${SKIP_PUBLISH_CHECK:-}"
bash scripts/mac-appstore-deploy.sh

echo ""
echo "=== Copy hosted config into existing App.app (if present) ==="
bash scripts/mac-copy-public-into-appapp.sh 2>/dev/null && bash scripts/verify-hosted-app-bundle.sh 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Build 1.0.1 (3) architecture restored — ready for Archive"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Compare to reference (optional):"
echo "  git diff appstore-1.0.1-build3 -- ios/App/App/capacitor.config.json"
echo ""
echo "Docs: docs/APPSTORE-BUILD-1.0.1-3.md"
echo ""
