#!/usr/bin/env bash
# After Xcode Run: verify the built App.app contains the same bundle as repo (proves deploy worked).
# v2 — ignores Index.noindex hollow App.app (requires mac-force-sync if you see line-25 BUILD_STAMP errors).
set -uo pipefail

if ! grep -q 'find_deployed_app' "$0" 2>/dev/null; then
  echo "ERROR: Outdated verify-xcode-app-bundle.sh (matches Index.noindex hollow build)."
  echo "  Run: bash scripts/mac-force-sync.sh"
  echo "  Then: bash scripts/mac-ios-v4-rebuild.sh"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

REPO_STAMP=$(tr -d '\n' < ios/App/App/BUILD_STAMP.txt 2>/dev/null || echo missing)
REPO_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' ios/App/App/public/index.html 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)

# Xcode also builds a hollow App.app under Index.noindex for indexing — NOT the installed app.
find_deployed_app() {
  local best="" best_mtime=0 candidate mtime
  while IFS= read -r candidate; do
    case "$candidate" in
      *Index.noindex*) continue ;;
      *Build/Intermediates*) continue ;;
    esac
    [ -f "$candidate/public/index.html" ] || continue
    mtime=$(stat -f '%m' "$candidate" 2>/dev/null || echo 0)
    if [ "$mtime" -gt "$best_mtime" ]; then
      best_mtime=$mtime
      best=$candidate
    fi
  done < <(
    find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*' -print 2>/dev/null
  )
  echo "$best"
}

APP=$(find_deployed_app)

REPO_HOSTED=0
if grep -q 'restorebraine.base44.app' ios/App/App/capacitor.config.json 2>/dev/null; then
  REPO_HOSTED=1
fi

echo "=== Verify installed App.app bundle ==="
echo "Repo mode:       $([ "$REPO_HOSTED" = "1" ] && echo 'hosted (Base44 live UI)' || echo 'bundled (localhost UI)')"
echo "Repo BUILD_STAMP: $REPO_STAMP"
echo "Repo entry JS:    $REPO_ENTRY"
echo ""

if [ -z "$APP" ]; then
  echo "FAIL: No deployed App.app with public/index.html in DerivedData"
  echo ""
  if [ "$REPO_STAMP" != missing ] && [ "$REPO_ENTRY" != missing ]; then
    echo "Repo bundle is READY ($REPO_STAMP) — do NOT rebuild in Terminal."
    echo "Xcode has not Run to your iPhone yet (only opened/indexed the project)."
  elif [ "$REPO_ENTRY" = missing ] && [ -f ios/App/App/BUILD_STAMP.txt ]; then
    echo "Repo ios/App/App/public/ is empty (wiped by mac-unblock-pull) — rebuild:"
    echo "  bash scripts/mac-ios-v4-deploy.sh --no-sync"
    echo ""
    echo "If Xcode already shows 'Finished running App on iPhone', the phone may still"
    echo "have the last good build — check the purple badge for v154 + index-CB3CwJ4f.js"
  fi
  echo ""
  echo "You only have an Index.noindex build (empty shell — NOT installed on device)."
  echo "You must Run to your iPhone in Xcode — Build alone is not enough."
  echo ""
  NON_INDEX=$(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*' ! -path '*Index.noindex*' -print 2>/dev/null | head -3)
  if [ -n "$NON_INDEX" ]; then
    echo "Non-index App.app exists but has no public/ — copy script did not run:"
    echo "$NON_INDEX" | sed 's/^/  /'
    echo "  Search Xcode build log for Restorebraine DEPLOY OK or xcode-copy-public-bundle.sh errors"
  else
    echo "No real App.app in DerivedData yet — press Run in Xcode with your iPhone selected."
  fi
  echo ""
  echo "Index shells (ignore):"
  find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*Index.noindex*' -print 2>/dev/null | head -2 | sed 's/^/  /'
  echo ""
  echo "All App.app in DerivedData:"
  bash scripts/mac-list-app-bundles.sh 2>/dev/null || find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*' 2>/dev/null | head -5 | sed 's/^/  /'
  echo ""
  echo "Fix — Xcode only (skip Terminal rebuild):"
  echo "  1. open ios/App/App.xcworkspace"
  echo "  2. Device menu: select your iPhone by name"
  echo "  3. Delete Restorebraine from the iPhone"
  echo "  4. Product -> Clean Build Folder"
  echo "  5. Product -> Run  (keyboard: Cmd+R)"
  echo "  6. Build log must show: Restorebraine DEPLOY OK"
  echo "  7. bash scripts/verify-xcode-app-bundle.sh"
  exit 1
fi

if [[ "$APP" == *Index.noindex* ]]; then
  echo "FAIL: Matched Index.noindex App.app (not installable). Run to device first."
  exit 1
fi

echo "Found (deployed): $APP"
APP_STAMP=$(tr -d '\n' < "$APP/BUILD_STAMP.txt" 2>/dev/null || echo missing)
APP_ENTRY=$(grep -o 'src="\./assets/[^"]*\.js"' "$APP/public/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)
APP_MANIFEST=$(cat "$APP/DEPLOY_MANIFEST.txt" 2>/dev/null || echo missing)
URL_IN_CONFIG=$(grep -c '"url"' "$APP/capacitor.config.json" 2>/dev/null || true)
URL_IN_CONFIG=${URL_IN_CONFIG:-0}

echo "App BUILD_STAMP:  $APP_STAMP"
echo "App entry JS:     $APP_ENTRY"
APP_URL=$(grep -o '"url": *"[^"]*"' "$APP/capacitor.config.json" 2>/dev/null | head -1 | sed 's/.*"url": *"\([^"]*\)".*/\1/' || echo missing)
echo "App server.url: $APP_URL"
echo "DEPLOY_MANIFEST:"
echo "$APP_MANIFEST" | sed 's/^/  /'
echo ""

FAIL=0
[ "$REPO_STAMP" = "$APP_STAMP" ] || { echo "FAIL: BUILD_STAMP mismatch — re-run: bash scripts/mac-ios-v4-rebuild.sh then Xcode Run"; FAIL=1; }
if [ "$REPO_ENTRY" = missing ] && [ "$APP_ENTRY" != missing ]; then
  echo "NOTE: repo public/ empty (run mac-ios-v4-deploy.sh --no-sync to rebuild)"
  echo "OK: App.app has entry $APP_ENTRY — iPhone likely has this build if Run succeeded"
elif [ "$REPO_ENTRY" != "$APP_ENTRY" ]; then
  echo "FAIL: entry JS mismatch (repo=$REPO_ENTRY app=$APP_ENTRY)"
  FAIL=1
fi
if [ "$REPO_HOSTED" = "1" ]; then
  if [[ "$APP_URL" != *"restorebraine.base44.app"* ]]; then
    echo "FAIL: hosted repo but App.app missing server.url — re-run mac-build.sh --hosted"
    FAIL=1
  else
    echo "OK: hosted App.app will load Base44 live (entry JS in public/ is shell fallback only)"
  fi
else
  [ "$URL_IN_CONFIG" = "0" ] || { echo "FAIL: bundled mode but server.url set — run mac-build.sh --bundled"; FAIL=1; }
fi
[ -f "$APP/public/assets/$APP_ENTRY" ] || { echo "FAIL: entry file missing inside App.app"; FAIL=1; }
[ -f "$APP/public/restorebraine-v4-bridge.js" ] || { echo "FAIL: restorebraine-v4-bridge.js missing from App.app/public — OAuth will not work"; FAIL=1; }
BRIDGE_BYTES=$(wc -c < "$APP/public/restorebraine-v4-bridge.js" 2>/dev/null || echo 0)
if [ "$BRIDGE_BYTES" -lt 30000 ] 2>/dev/null; then
  echo "FAIL: restorebraine-v4-bridge.js too small ($BRIDGE_BYTES bytes) — stub or stale"
  FAIL=1
else
  echo "v4-bridge: ${BRIDGE_BYTES} bytes in App.app/public"
fi

if grep -q 'restorebraine-v4-bridge\.js' "$APP/public/index.html" 2>/dev/null; then
  echo "FAIL: index.html loads v4-bridge synchronously — causes white screen on launch"
  FAIL=1
else
  echo "OK: index.html uses async bridge load (no sync script)"
fi

if [ "$FAIL" -eq 0 ]; then
  echo "OK: App.app on Mac matches repo"
  echo ""
  echo "NOTE: This checks DerivedData on your Mac, NOT the iPhone itself."
  echo "If UI on phone still looks old:"
  echo "  Account tab -> Runtime diagnostic (origin must be restorebraine.base44.app)"
  echo "  bash scripts/mac-push-to-iphone.sh"
  echo "  or Xcode: delete app -> Clean -> Run (Cmd+R)"
  if [ "$REPO_HOSTED" = "1" ]; then
    echo "Hosted mode: phone UI comes from Base44 live bundle, not ios/public entry JS"
  else
    echo "Bundled mode: phone UI from App.app/public entry JS"
  fi
else
  echo ""
  echo "Fix: delete app -> Clean Build Folder -> Run -> build log must show 'Restorebraine DEPLOY OK'"
  exit 1
fi
