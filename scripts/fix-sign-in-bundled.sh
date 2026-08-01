#!/usr/bin/env bash
# fix-sign-in-bundled.sh — Sign In tap shows no change / OAuth sheet never opens
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo
echo "══════════════════════════════════════════════════════════════"
echo " FIX SIGN IN (bundled) — native OAuth + rebuild"
echo "══════════════════════════════════════════════════════════════"
echo

echo "==> [1] Sync branch"
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install

echo
echo "==> [2] Rebuild bundled ios/public (src + SignedOutLanding feedback)"
npm run apply:v87-from-omega3 -- --skip-sync

echo
echo "==> [3] Verify Sign In wiring"
node scripts/diagnose-sign-in-tap.mjs
node scripts/prove-phone-load.mjs || true

echo
banner() {
  echo
  echo "══════════════════════════════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════════════════════════════"
}

banner "REQUIRED ON IPHONE (AppDelegate.swift changed — Xcode rebuild mandatory)"
echo " 1. Delete Restorebraine from iPhone"
echo " 2. Restart iPhone (power off → wait 30s → on)"
echo " 3. Xcode → Product → Clean Build Folder"
echo " 4. Run on iPhone"
echo
echo " TEST: Tap Sign In → button says 'Opening sign in…' → Google sheet appears"
echo " If button text never changes → old bundle still on phone (repeat steps 1–4)"
echo "══════════════════════════════════════════════════════════════"

if [[ "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || true
fi
