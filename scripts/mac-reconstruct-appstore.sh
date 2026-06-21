#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-build.sh --hosted"
exec bash "$(dirname "$0")/mac-build.sh" --hosted "$@"
