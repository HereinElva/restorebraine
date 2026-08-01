#!/usr/bin/env bash
# One Mac command — sync + hosted apply (v87 baseline) + audits
# For bundled experimental: npm run apply:v87-from-omega3 -- --bundled
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> mac:terminal-build — hosted apply (v87 baseline, reliable on iPhone)"
echo ""

git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install
npm run apply:v87-from-omega3 -- --no-open --skip-sync
npm run audit:v87-improvements
npm run audit:pre-build 2>/dev/null || true
npm run diagnose:apply-regression
