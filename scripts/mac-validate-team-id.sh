#!/usr/bin/env bash
# Validate Apple Developer Team ID (10 uppercase letters/digits).
validate_team_id() {
  local team="${1:-}"
  if [[ ! "$team" =~ ^[A-Z0-9]{10}$ ]]; then
    return 1
  fi
  case "$team" in
    YOUR_TEAM_ID|TEAM_ID|XXXXXXXXXX|YOURTEAMID)
      return 1
      ;;
  esac
  return 0
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  if [ $# -lt 1 ]; then
    echo "usage: $0 TEAM_ID" >&2
    exit 1
  fi
  if validate_team_id "$1"; then
    echo "OK: $1"
    exit 0
  fi
  echo "INVALID: '$1' is not a valid Team ID (expected 10 chars, e.g. V378L53XQP)" >&2
  exit 1
fi
