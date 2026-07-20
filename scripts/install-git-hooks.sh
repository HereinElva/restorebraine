#!/usr/bin/env bash
# Install git hooks that block the five post-v87 failure patterns.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOOKS_DIR="$ROOT/.githooks"
mkdir -p "$HOOKS_DIR"

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Block bundled mode commits
if grep -q 'appStartPath' capacitor.config.json 2>/dev/null; then
  echo "✗ pre-commit: appStartPath in capacitor.config.json (Pattern 4 — use hosted mode)"
  echo "  Fix: npm run cap:hosted"
  exit 1
fi

# Block forbidden login rewrites (Pattern 5)
for f in \
  src/components/auth/NativeLoginCard.jsx \
  src/components/auth/SignInScreen.jsx \
  src/pages/LoginPage.jsx; do
  if git diff --cached --name-only | grep -qx "$f" 2>/dev/null; then
    echo "✗ pre-commit: $f is forbidden (Pattern 5 — keep v87 SignedOutLanding)"
    exit 1
  fi
done

# Warn on src/ changes without Base44 publish reminder (Pattern 1 + 2)
if git diff --cached --name-only | grep -qE '^(src/|index\.html|public/)'; then
  echo "⚠ src/ staged — after commit you MUST Base44 Publish ALL files (Pattern 2)"
  echo "  npm run base44:export-pack → Publish → npm run align:watch"
fi

exit 0
EOF

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "==> pre-push: gate-five-patterns (read-only live probes)"
if ! node scripts/gate-five-patterns.mjs 2>/dev/null; then
  echo
  echo "⚠ pre-push: live Base44 not fully aligned — push allowed but iPhone may show stale UI"
  echo "  Run: npm run align:all"
  echo "  Or:  npm run align:watch (after Base44 Publish)"
  # Do not block push — Mac may be ahead of Base44 intentionally
fi
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-push"
git config core.hooksPath .githooks

echo "✓ Git hooks installed → .githooks/"
echo "  pre-commit: blocks appStartPath + forbidden login files"
echo "  pre-push:   warns if live Base44 not aligned"
echo
echo "  Re-run anytime: bash scripts/install-git-hooks.sh"
