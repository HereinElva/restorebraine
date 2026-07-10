#!/usr/bin/env bash
# Ensure DEVELOPMENT_TEAM is persisted in project.pbxproj (survives git reset --hard).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PBX="ios/App/App.xcodeproj/project.pbxproj"
TEAM=$(bash scripts/mac-resolve-development-team.sh)

if [ ! -f "$PBX" ]; then
  echo "error: $PBX missing"
  exit 1
fi

changed=0

ensure_team_setting() {
  local block_name="$1"
  if grep -A40 "$block_name" "$PBX" | grep -q "DEVELOPMENT_TEAM = $TEAM;"; then
    return 0
  fi
  if grep -A40 "$block_name" "$PBX" | grep -q 'DEVELOPMENT_TEAM = '; then
    perl -i -pe "s/DEVELOPMENT_TEAM = [A-Z0-9]+;/DEVELOPMENT_TEAM = $TEAM;/g" "$PBX"
    changed=1
    return 0
  fi
  return 1
}

# App target Debug/Release (required for device signing)
if ! grep -q "DEVELOPMENT_TEAM = $TEAM;" "$PBX"; then
  # Insert after CODE_SIGN_STYLE = Automatic; in App target configs only
  perl -i -0pe "s/(504EC3171FED79650016851F \/\* Debug \*\/ = \{.*?CODE_SIGN_STYLE = Automatic;\n)/\$1\t\t\t\tDEVELOPMENT_TEAM = $TEAM;\n/s" "$PBX" || true
  perl -i -0pe "s/(504EC3181FED79650016851F \/\* Release \*\/ = \{.*?CODE_SIGN_STYLE = Automatic;\n)/\$1\t\t\t\tDEVELOPMENT_TEAM = $TEAM;\n/s" "$PBX" || true
  changed=1
fi

# Project-level Debug/Release (inheritance for CLI xcodebuild)
for marker in "504EC3141FED79650016851F /* Debug */" "504EC3151FED79650016851F /* Release */"; do
  if ! grep -A35 "$marker" "$PBX" | grep -q "DEVELOPMENT_TEAM = $TEAM;"; then
    if grep -A35 "$marker" "$PBX" | grep -q 'DEBUG_INFORMATION_FORMAT'; then
      perl -i -0pe "s/($marker = \{.*?DEBUG_INFORMATION_FORMAT = [^;]+;\n)/\$1\t\t\t\tDEVELOPMENT_TEAM = $TEAM;\n/s" "$PBX" || true
      changed=1
    fi
  fi
done

# TargetAttributes DevelopmentTeam (Xcode UI persistence)
if ! grep -q "DevelopmentTeam = $TEAM;" "$PBX"; then
  if grep -q 'ProvisioningStyle = Automatic;' "$PBX"; then
    perl -i -pe "s/(ProvisioningStyle = Automatic;)/\$1\n\t\t\t\t\t\tDevelopmentTeam = $TEAM;/" "$PBX"
    changed=1
  fi
fi

if [ "$changed" = "1" ]; then
  echo "Updated $PBX with DEVELOPMENT_TEAM=$TEAM"
else
  echo "OK: DEVELOPMENT_TEAM=$TEAM already set in $PBX"
fi
