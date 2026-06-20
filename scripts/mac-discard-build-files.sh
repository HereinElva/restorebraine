#!/usr/bin/env bash
# Discard auto-generated files that block git pull (safe — npm run build regenerates them).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

restore_paths() {
  git restore --staged --worktree "$@" 2>/dev/null \
    || git checkout -f HEAD -- "$@" 2>/dev/null \
    || git checkout -- "$@" 2>/dev/null \
    || true
}

# Cap-sync bundles block pull when locally modified or untracked — delete and restore from HEAD.
rm -rf ios/App/App/public/assets
mkdir -p ios/App/App/public/assets
restore_paths ios/App/App/public/

restore_paths \
  ios/App/App/BUILD_STAMP.txt \
  src/lib/build-info.js \
  src/lib/native-bundle-mode.js \
  src/deploy-marker.js \
  index.html \
  capacitor.config.json \
  ios/App/App/capacitor.config.json \
  ios/App/App.xcodeproj/project.pbxproj

git clean -ffdx ios/App/App/public/assets/ 2>/dev/null || true

echo "Discarded local build/config stamp files, Xcode project.pbxproj, and iOS public assets (rm + restore)."
