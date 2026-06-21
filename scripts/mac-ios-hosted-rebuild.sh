#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-build.sh --no-git --hosted"
exec bash "$(dirname "$0")/mac-build.sh" --hosted --no-git "$@"
