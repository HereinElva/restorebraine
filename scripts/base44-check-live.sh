#!/usr/bin/env bash
# Terminal-only check — no Safari needed. Says PASS or FAIL in plain English.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

GIT=$(grep -E '^export const DEPLOY_BUILD = ' src/deploy-marker.js | sed 's/.*= //;s/;//')
HTML=$(curl -sL --max-time 20 "https://restorebraine.base44.app/?nocache=$(date +%s)" || true)

LIVE=$(echo "$HTML" | grep -oE 'restorebraine-deploy" content="v[0-9]+"|content="v[0-9]+" name="restorebraine-deploy"' | grep -oE 'v[0-9]+' | head -1 | tr -d 'v' || echo "?")
BUNDLE=$(echo "$HTML" | grep -oE 'assets/index-[^"]+\.js' | head -1 | sed 's|assets/||' || echo "unknown")

HAS_APPLE=$(echo "$HTML" | grep -qi 'Continue With Apple' && echo yes || echo no)
HAS_EMAIL=$(echo "$HTML" | grep -qi 'Sign In With Email' && echo yes || echo no)
HAS_OLD=$(echo "$HTML" | grep -qi 'Continue with Google' && echo yes || echo no)

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  BASE44 LIVE CHECK (Terminal only — no Safari needed)"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  Git expects:     v${GIT}"
echo "  Live site has:   v${LIVE}  (bundle: ${BUNDLE})"
echo "  Apple login:     ${HAS_APPLE}"
echo "  Email login:     ${HAS_EMAIL}"
echo ""

if [ "$LIVE" = "$GIT" ] && [ "$HAS_APPLE" = "yes" ]; then
  echo "  ██████████████████████████████████████████████████████████"
  echo "  ██  PASS — Base44 is updated. Run native step next.     ██"
  echo "  ██████████████████████████████████████████████████████████"
  echo ""
  echo "  Next command:"
  echo "    bash scripts/mac-resync-omega.sh --native-only"
  exit 0
fi

if [ "$LIVE" = "$GIT" ]; then
  echo "  △  Version matches but login UI may be incomplete."
  echo "     Finish the wizard, Publish, run this script again."
  exit 1
fi

echo "  ██████████████████████████████████████████████████████████"
echo "  ██  FAIL — Live site is still OLD (v${LIVE}, need v${GIT})       ██"
echo "  ██████████████████████████████████████████████████████████"
echo ""
echo "  You still need to paste files in Base44 and click Publish."
echo ""
  echo "  Next command:"
  echo "    bash scripts/base44-copy-one.sh --reset"
echo ""
exit 1
