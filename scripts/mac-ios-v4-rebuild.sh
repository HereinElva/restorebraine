#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-build.sh --no-git"
exec bash "$(dirname "$0")/mac-build.sh" --bundled --no-git "$@"
