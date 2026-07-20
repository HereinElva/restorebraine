#!/usr/bin/env bash
# terminal-revert-all.sh — zero-prompt terminal revert (no nuke, no Base44, no Safari)
#
# Hosted v87 CANNOT revert iPhone UI from terminal alone (WKWebView loads Base44).
# Default mode: bundled omega-3 — GitHub + Capacitor + UI all from Mac/Xcode.
#
# Usage:
#   npm run revert:terminal                    # bundled omega-3 (full terminal control)
#   npm run revert:terminal -- --bundled-v87   # v87 source, bundled on phone
#   npm run revert:terminal -- --hosted-v87    # v87 git + hosted shell only (UI still Base44)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${TERMINAL_REVERT_MODE:-bundled-omega3}"
BRANCH="${TERMINAL_REVERT_BRANCH:-cursor/apple-privacy-plist-bacf}"
OPEN_XCODE="${OPEN_XCODE:-1}"

for arg in "$@"; do
  case "$arg" in
    --bundled-omega3|--omega3) MODE="bundled-omega3" ;;
    --bundled-v87) MODE="bundled-v87" ;;
    --hosted-v87) MODE="hosted-v87" ;;
    --no-open) OPEN_XCODE=0 ;;
    -h|--help)
      cat << 'EOF'
Terminal-only revert — no prompts, no Base44 browser, no nuke script.

  npm run revert:terminal                 Omega 3 bundled (recommended — phone UI from Mac)
  npm run revert:terminal -- --bundled-v87  v87 branch bundled (phone UI from Mac)
  npm run revert:terminal -- --hosted-v87   v87 hosted shell only (UI still live Base44)

After any mode: Xcode → Product → Clean Build Folder → Run
EOF
      exit 0
      ;;
  esac
done

banner() {
  echo
  echo "══════════════════════════════════════════════════════════════"
  echo " $1"
  echo "══════════════════════════════════════════════════════════════"
}

wipe_build_debris() {
  git clean -fd -- dist ios/App/App/public ios/App/build node_modules/.vite 2>/dev/null || true
  rm -rf ios/App/Pods ios/App/Podfile.lock 2>/dev/null || true
  if [[ "$(uname -s)" == "Darwin" ]]; then
    DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
    if [[ -d "$DERIVED" ]]; then
      find "$DERIVED" -maxdepth 1 -type d \( -name 'App-*' -o -name '*restorebraine*' -o -name '*Restorebraine*' \) \
        -exec rm -rf {} + 2>/dev/null || true
    fi
    rm -rf ~/Library/Caches/com.apple.WebKit ~/Library/WebKit 2>/dev/null || true
  fi
}

banner "TERMINAL REVERT — mode: $MODE"
echo " Repo: $ROOT"
echo " No Base44 browser · No nuke script · No interactive prompts"
echo

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run from restorebraine repo root."
  exit 1
fi

case "$MODE" in
  bundled-omega3)
    echo "==> [1/6] Fetch tags + reset to omega-3 (bundled v261 gallery reference)"
    git fetch origin --tags
    git reset --hard omega-3
    wipe_build_debris
    echo "==> [2/6] npm install"
    npm install
    echo "==> [3/6] Bundled native build (phone UI from ios/public — NOT Base44)"
    npm run build:native-local
    echo "==> [4/6] CocoaPods"
    (cd ios/App && pod install)
    echo "==> [5/6] Verify bundled mode (no server.url)"
    if grep -q '"url".*restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
      echo "WARN: server.url still set — forcing local bundle"
      node scripts/use-local-native-bundle.mjs --local 2>/dev/null || true
      npx cap sync ios 2>/dev/null || true
    fi
    STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo 'see Xcode')"
    echo "==> [6/6] Sync ghost-build blocklist + scan CDN"
    node scripts/sync-ghost-builds-native.mjs
    node scripts/scan-ghost-builds.mjs || true
    echo " BUILD_STAMP: $STAMP"
    echo " Phone loads: capacitor:// bundled ios/public (terminal-controlled)"
    ;;

  bundled-v87)
    echo "==> [1/6] Fetch + reset to origin/$BRANCH (v87 app source)"
    git fetch origin "$BRANCH" --tags
    git reset --hard "origin/$BRANCH"
    wipe_build_debris
    echo "==> [2/6] npm install"
    npm install
    echo "==> [3/6] Bundled native build (v87 UI in Mac bundle — NOT live Base44)"
    npm run build:native-local
    echo "==> [4/6] CocoaPods"
    (cd ios/App && pod install)
    echo "==> [5/6] Verify"
    node scripts/verify-v87-baseline.mjs || echo "WARN: v87 baseline check failed on bundled path"
    STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo 'see Xcode')"
    echo "==> [6/6] Sync ghost-build blocklist"
    node scripts/sync-ghost-builds-native.mjs
    node scripts/scan-ghost-builds.mjs || true
    echo " Done — v87 bundled revert complete"
    echo " BUILD_STAMP: $STAMP"
    echo " Phone loads: capacitor:// bundled ios/public (terminal-controlled)"
    ;;

  hosted-v87)
    echo "==> [1/5] Fetch + reset to origin/$BRANCH"
    git fetch origin "$BRANCH" --tags
    git reset --hard "origin/$BRANCH"
    wipe_build_debris
    echo "==> [2/5] npm install"
    npm install
    echo "==> [3/5] Hosted Capacitor shell (WKWebView → restorebraine.base44.app)"
    node scripts/use-local-native-bundle.mjs --hosted
    npm run ios:prepare
    echo "==> [4/5] CocoaPods"
    (cd ios/App && pod install)
    STAMP="$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo 'see Xcode')"
    echo "==> [5/5] Done — hosted shell only"
    echo " BUILD_STAMP: $STAMP"
    echo
    echo " ⚠ iPhone UI STILL comes from live Base44 — this mode cannot revert UI from terminal."
    echo "   Use default bundled mode instead: npm run revert:terminal"
    ;;

  *)
    echo "Unknown mode: $MODE"
    exit 1
    ;;
esac

banner "XCODE"
echo " 1. open ios/App/App.xcworkspace"
echo " 2. Product → Clean Build Folder"
echo " 3. Run on iPhone"
echo
if [[ "$OPEN_XCODE" == "1" && "$(uname -s)" == "Darwin" ]]; then
  open ios/App/App.xcworkspace 2>/dev/null || open ios/App/App.xcworkspace 2>/dev/null || true
fi
echo "══════════════════════════════════════════════════════════════"
