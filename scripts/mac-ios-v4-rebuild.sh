#!/usr/bin/env bash
# v4-core: full deploy (npm + Xcode pipeline). Use this instead of npm-only rebuild.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/mac-ios-v4-deploy.sh" "$@"
