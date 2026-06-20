#!/usr/bin/env bash
# Complete rebuild: build v4 native shell + all UI/auth fixes (gallery, folders, OAuth v100).
# Same as mac-pull-and-rebuild.sh — use this name when you want the v4-core bundle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/mac-pull-and-rebuild.sh" "$@"
