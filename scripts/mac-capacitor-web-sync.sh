#!/usr/bin/env bash
# Deprecated bundled shortcut — hosted is the App Store default.
echo "→ Use hosted build (loads live Base44): bash scripts/mac-build.sh --no-git"
echo "  (This script previously forced --bundled, which ignores Base44 Publish.)"
exec bash "$(dirname "$0")/mac-build.sh" --hosted --no-git "$@"
