#!/usr/bin/env bash
echo "→ Use: bash scripts/mac-sync-github.sh && bash scripts/mac-build.sh --no-git"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
bash scripts/mac-sync-github.sh
exec bash scripts/mac-build.sh --no-git "$@"
