#!/usr/bin/env bash
# Deprecated alias — use mac-resync-omega.sh (Base44 first, then Capacitor native).
#
# mac-start-fresh previously ran Capacitor rebuild BEFORE Base44 Publish, which
# caused drift. mac-resync-omega runs the correct order:
#   Phase 1 — Base44 publish pack + verify Omega/auth
#   Phase 2 — hosted Capacitor full replace (after live Base44 matches git)
#
# Usage (same flags as mac-resync-omega):
#   bash scripts/mac-start-fresh.sh
#   bash scripts/mac-start-fresh.sh --base44-only
#   bash scripts/mac-start-fresh.sh --native-only
#   bash scripts/mac-start-fresh.sh --no-git
set -euo pipefail
echo "Note: mac-start-fresh → mac-resync-omega (Base44 publish first, then native)"
echo ""
exec bash "$(dirname "$0")/mac-resync-omega.sh" "$@"
