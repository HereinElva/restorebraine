#!/usr/bin/env bash
# Explains the three deploy targets — web vs Capacitor bundled vs Capacitor hosted.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BUILD_NUM=$(grep -E '^export const BUILD_NUMBER = ' src/lib/build-info.js 2>/dev/null | sed 's/.*= //;s/;//' || echo '?')
LOCAL_FLAG=$(grep -o 'LOCAL_NATIVE_BUNDLE = [^;]*' src/lib/native-bundle-mode.js 2>/dev/null || echo 'unknown')
URL_COUNT=$(grep -c '"url"' ios/App/App/capacitor.config.json 2>/dev/null || echo '?')

ENTRY_DIST=""
ENTRY_IOS=""
[ -f dist/index.html ] && ENTRY_DIST=$(grep -o 'src="\./assets/[^"]*\.js"' dist/index.html | head -1 | sed 's/.*assets\///;s/"//' || true)
[ -f ios/App/App/public/index.html ] && ENTRY_IOS=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html | head -1 | sed 's/.*assets\///;s/"//' || true)

cat <<EOF
╔══════════════════════════════════════════════════════════════════╗
║  Restorebraine — THREE separate deploy targets                   ║
╚══════════════════════════════════════════════════════════════════╝

1) BASE44 HOSTED WEB (restorebraine.base44.app)
   • Updated via Base44 Code editor → Publish
   • GitHub push alone does NOT update the live website
   • Run: node scripts/list-base44-publish-files.mjs

2) CAPACITOR BUNDLED NATIVE (build v4 — capacitor://localhost)
   • Web app source (src/) → Vite dist/ → ios/App/App/public/ → iPhone
   • ONE command merges web into iOS:
       npm run cap:merge-web-into-ios
     (or full pipeline: npm run build:native-local)
   • Then install: bash scripts/mac-ios-v4-deploy.sh --sync

3) CAPACITOR HOSTED NATIVE (WebView loads restorebraine.base44.app)
   • npm run build  (sets server.url)
   • Shows whatever is live on Base44 — NOT your local src/ unless published
   • USE THIS for TestFlight / App Store (Omega-style — login works):
       bash scripts/mac-appstore-deploy.sh

4) DEV ONLY — CAPACITOR BUNDLED (capacitor://localhost)
   • bash scripts/mac-capacitor-web-sync.sh
   • Login OAuth is fragile — do NOT upload to App Store from this mode

──────────────────────────────────────────────────────────────────
Current repo state:
  BUILD_NUMBER:        v${BUILD_NUM}
  ${LOCAL_FLAG}
  server.url in config: ${URL_COUNT} (must be 0 for bundled v4)
  dist entry JS:       ${ENTRY_DIST:-missing — run vite build}
  ios/public entry JS: ${ENTRY_IOS:-missing — run cap:merge-web-into-ios}

If web fixes were made in Base44 editor only, they are NOT in this repo.
Native bundled app reads src/ in git — publish to Base44 AND commit src/ changes.

If dist entry ≠ ios/public entry, Capacitor did not merge — run:
  npm run cap:merge-web-into-ios

EOF

if [ -n "$ENTRY_DIST" ] && [ -n "$ENTRY_IOS" ] && [ "$ENTRY_DIST" != "$ENTRY_IOS" ]; then
  echo "⚠️  MISMATCH: dist has $ENTRY_DIST but ios/public has $ENTRY_IOS"
  echo "   Run: npm run cap:merge-web-into-ios"
  exit 1
fi
