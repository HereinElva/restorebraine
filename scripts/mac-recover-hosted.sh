#!/usr/bin/env bash
# Recover from git pull failures + accidental bundled builds.
# Alias for mac-complete-rebuild.sh
#
# Usage:
#   bash scripts/mac-recover-hosted.sh
exec bash "$(dirname "$0")/mac-complete-rebuild.sh" "$@"
