#!/usr/bin/env bash
# After Xcode Run: verify the built App.app contains the same bundle as repo (proves deploy worked).
set -uo pipefail
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

echo "=== Verify installed App.app bundle ==="
echo "Repo BUILD_STAMP: $REPO_STAMP"
echo "Repo entry JS:    $REPO_ENTRY"
echo ""

if [ -z "$APP" ]; then
  echo "FAIL: No deployed App.app with public/index.html in DerivedData"
  echo ""
  echo "This usually means either:"
  echo "  1. You have not Run (Cmd+R) to device/simulator yet — only an Index build exists"
  echo "  2. The 'Restorebraine Copy Public Bundle' script failed — check Xcode build log"
  echo ""
  echo "Index builds (ignore these — they are empty shells):"
  find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*Index.noindex*' -print 2>/dev/null | head -3 | sed 's/^/  /'
  echo ""
  echo "Fix: Xcode -> Run to your iPhone -> search build log for 'Restorebraine DEPLOY OK'"
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
URL_IN_CONFIG=$(grep -c '"url"' "$APP/capacitor.config.json" 2>/dev/null || echo 0)

echo "App BUILD_STAMP:  $APP_STAMP"
echo "App entry JS:     $APP_ENTRY"
echo "DEPLOY_MANIFEST:"
echo "$APP_MANIFEST" | sed 's/^/  /'
echo "server.url count: $URL_IN_CONFIG (must be 0 for v4-core)"
echo ""

FAIL=0
[ "$REPO_STAMP" = "$APP_STAMP" ] || { echo "FAIL: BUILD_STAMP mismatch — re-run: bash scripts/mac-ios-v4-rebuild.sh then Xcode Run"; FAIL=1; }
[ "$REPO_ENTRY" = "$APP_ENTRY" ] || { echo "FAIL: entry JS mismatch"; FAIL=1; }
[ "$URL_IN_CONFIG" = "0" ] || { echo "FAIL: server.url set — app loads hosted site not bundle"; FAIL=1; }
[ -f "$APP/public/assets/$APP_ENTRY" ] || { echo "FAIL: entry file missing inside App.app"; FAIL=1; }

if [ "$FAIL" -eq 0 ]; then
  echo "OK: App.app matches repo — device should show v4-core updates"
else
  echo ""
  echo "Fix: delete app -> Clean Build Folder -> Run -> build log must show 'Restorebraine DEPLOY OK'"
  exit 1
fi
