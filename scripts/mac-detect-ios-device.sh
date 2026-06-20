#!/usr/bin/env bash
# Print UDID of first connected physical iPhone (not Simulator). Exit 1 if none.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

pick_udid() {
  # Xcode 15+: devicectl (most reliable when available)
  if xcrun devicectl list devices 2>/dev/null | grep -q 'iPhone'; then
    xcrun devicectl list devices 2>/dev/null \
      | awk '/iPhone/ && !/Simulator/ { gsub(/[^0-9A-Fa-f-]/,"",$1); if ($1 ~ /^[0-9A-Fa-f-]{25,36}$/) { print $1; exit } }'
    return
  fi

  # xctrace fallback
  xcrun xctrace list devices 2>/dev/null \
    | grep -i 'iphone' \
    | grep -vi 'simulator' \
    | head -1 \
    | sed -n 's/.*(\([0-9A-Fa-f-]\{25,36\}\)).*/\1/p'
}

UDID=$(pick_udid || true)

if [ -z "$UDID" ]; then
  echo "error: no physical iPhone connected via USB" >&2
  echo "" >&2
  echo "Connect your iPhone, unlock it, tap Trust, then retry." >&2
  echo "Or install manually in Xcode: Product → Run (Cmd+R)" >&2
  exit 1
fi

echo "$UDID"
