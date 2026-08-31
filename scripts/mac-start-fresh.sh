#!/usr/bin/env bash
# Deprecated alias — use mac-build.sh (one command, full Xcode replace, no Base44).
exec bash "$(dirname "$0")/mac-build.sh" "$@"
