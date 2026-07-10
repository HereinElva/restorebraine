#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-sync-apple-fix.sh"
echo "   (or: bash scripts/mac-sync-github.sh)"
exec bash "$(dirname "$0")/mac-sync-github.sh" "$@"
