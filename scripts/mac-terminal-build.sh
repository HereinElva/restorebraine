#!/usr/bin/env bash
# One Mac command — sync + bundled apply (terminal UI on iPhone) + audits
# For hosted CDN: npm run apply:v87-from-omega3 -- --hosted
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> mac:terminal-build — bundled apply (Mac controls iPhone UI)"
echo ""

git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install
npm run apply:v87-from-omega3 -- --no-open --skip-sync
npm run ghosts:prove-apply
npm run prove:phone
npm run audit:pre-build 2>/dev/null || true
