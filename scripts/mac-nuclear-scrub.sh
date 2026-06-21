#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-build.sh --nuclear"
exec bash "$(dirname "$0")/mac-build.sh" --nuclear "$@"
