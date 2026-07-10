#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Usage: bash scripts/base44-copy.sh <path>"
  echo ""
  echo "Example: bash scripts/base44-copy.sh index.html"
  echo ""
  echo "All 25 files (run one at a time):"
  node scripts/list-base44-publish-files.mjs 2>/dev/null | sed -n 's/^  - //p'
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "File not found: $FILE"
  exit 1
fi

pbcopy < "$FILE"
echo "Copied to clipboard: $FILE"
echo ""
echo "NOW go to Base44 Code editor in your BROWSER (not Terminal):"
echo "  1. Open file: $FILE"
echo "  2. Select All (Cmd+A)"
echo "  3. Paste (Cmd+V)"
echo "  4. Save"
echo ""
echo "Do NOT paste HTML or code into Terminal."
