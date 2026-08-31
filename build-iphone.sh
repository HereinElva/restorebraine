#!/usr/bin/env bash
# Restorebraine iPhone build — run from repo root on your Mac.
#   bash build-iphone.sh
set -euo pipefail
cd "$(dirname "$0")"
exec bash scripts/mac-build.sh "$@"
