#!/usr/bin/env bash
# One Mac terminal command — full sync + bundled apply + audit (no Safari)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> mac:terminal-build — all Terminal, no Base44 browser"
echo ""

git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install
npm run apply:v87-from-omega3 -- --no-open --skip-sync
npm run audit:v87-improvements
npm run audit:pre-build
