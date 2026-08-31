#!/usr/bin/env bash
# Terminal-only check — bundle markers + deploy stamp (not just meta tag).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

exec node scripts/audit-base44-bundle.mjs
