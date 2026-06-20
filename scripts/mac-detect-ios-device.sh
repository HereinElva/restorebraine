#!/usr/bin/env bash
# Print UDID of first paired physical iPhone (USB or wireless). Exit 1 if none.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

pick_udid() {
  local line udid

  # Xcode 15+: devicectl — includes wireless-paired devices
  if xcrun devicectl list devices >/dev/null 2>&1; then
    while IFS= read -r line; do
      case "$line" in
        *Simulator*|*simulator*) continue ;;
        *iPhone*|*iPad*)
          udid=$(echo "$line" | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)
          if [ -n "$udid" ]; then
            echo "$udid"
            return 0
          fi
          ;;
      esac
    done < <(xcrun devicectl list devices 2>/dev/null | tail -n +3)
  fi

  # xctrace fallback (USB devices often show here)
  udid=$(xcrun xctrace list devices 2>/dev/null \
    | grep -iE 'iphone|ipad' \
    | grep -vi 'simulator' \
    | head -1 \
    | sed -n 's/.*(\([0-9A-Fa-f-]\{25,36\}\)).*/\1/p')
  if [ -n "$udid" ]; then
    echo "$udid"
    return 0
  fi

  # Legacy instruments
  udid=$(instruments -s devices 2>/dev/null \
    | grep -iE 'iphone|ipad' \
    | grep -vi 'simulator' \
    | head -1 \
    | sed -n 's/.*\[\([0-9A-Fa-f-]\{25,36\}\)\].*/\1/p')
  if [ -n "$udid" ]; then
    echo "$udid"
    return 0
  fi

  return 1
}

UDID=$(pick_udid || true)

if [ -z "$UDID" ]; then
  echo "error: no paired iPhone/iPad found" >&2
  echo "" >&2
  echo "Wireless or USB:" >&2
  echo "  1. Connect iPhone (USB) OR enable wireless in Xcode:" >&2
  echo "     Window → Devices and Simulators → your iPhone → Connect via network" >&2
  echo "  2. Unlock iPhone, tap Trust This Computer" >&2
  echo "  3. Retry: bash scripts/mac-ios-v4-install.sh" >&2
  echo "" >&2
  echo "Or skip CLI install — bundle is already built. In Xcode:" >&2
  echo "  open ios/App/App.xcworkspace → select iPhone → Clean → Run (Cmd+R)" >&2
  exit 1
fi

echo "$UDID"
