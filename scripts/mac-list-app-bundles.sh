#!/usr/bin/env bash
# List every App.app in DerivedData and whether it has a deployed public/ bundle.
set -uo pipefail

echo "=== DerivedData App.app scan ==="
echo ""

count=0
while IFS= read -r app; do
  [ -n "$app" ] || continue
  count=$((count + 1))
  has_public=no
  has_stamp=no
  entry=missing
  [ -f "$app/public/index.html" ] && has_public=yes
  [ -f "$app/BUILD_STAMP.txt" ] && has_stamp=yes
  if [ "$has_public" = yes ]; then
    entry=$(grep -o 'src="\./assets/[^"]*\.js"' "$app/public/index.html" 2>/dev/null | head -1 | sed 's/.*assets\///;s/"//' || echo missing)
  fi
  kind=deployed
  case "$app" in
    *Index.noindex*) kind=INDEX-SHELL ;;
    *iphonesimulator*) kind=simulator ;;
    *iphoneos*) kind=device ;;
  esac
  echo "[$kind] $app"
  echo "  public/index.html: $has_public  BUILD_STAMP: $has_stamp  entry: $entry"
  echo ""
done < <(find ~/Library/Developer/Xcode/DerivedData -name 'App.app' -path '*/Build/Products/*' 2>/dev/null | sort)

if [ "$count" -eq 0 ]; then
  echo "No App.app found — Xcode has never built this project (or DerivedData was wiped)."
  echo "Run in Xcode: Product -> Run with your iPhone selected."
else
  echo "Total: $count App.app bundle(s)"
  echo ""
  echo "Verify needs a [device] or [simulator] bundle with public/index.html=yes."
  echo "INDEX-SHELL bundles are empty — ignore them."
fi
