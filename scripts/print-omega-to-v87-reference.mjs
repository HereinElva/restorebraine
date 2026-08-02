#!/usr/bin/env node
/**
 * Reference: Omega 3 archived → corrections → v87 baseline.
 * Use when diagnosing "no change" or planning Base44 full publish.
 */
import { execSync } from 'node:child_process';
import {
  OMEGA3_TAG,
  OMEGA3_COMMIT,
  V87_TIP,
  HOSTED,
  TIER_FULL,
  TIER_GALLERY,
  OMEGA3_TO_V87_COMMITS,
} from './base44-v87-publish-manifest.mjs';

function git(args) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

const head = git('rev-parse --short HEAD');
const omega3 = git(`rev-parse --short ${OMEGA3_TAG}^{commit}`);

console.log(`
═══════════════════════════════════════════════════════════════
 OMEGA 3 → v87 REFERENCE (archived good state + corrections)
═══════════════════════════════════════════════════════════════

OMEGA 3 ARCHIVE (gallery/organize reference — bundled v261)
  Tag:     ${OMEGA3_TAG}
  Commit:  ${omega3} (${OMEGA3_COMMIT})
  Restore: git reset --hard ${OMEGA3_TAG} && bash build-iphone.sh --no-git
  Doc:     docs/OMEGA-3.md

What Omega 3 proved working (keep through v87):
  • Organize batch sorting + multi-round (OrganizeButton + media-organize.js)
  • Folder persistence across restart + pull-to-refresh (PullToRefresh.jsx)
  • Gallery tabs, MobileGallery layout, folder tiles
  • Upload pipeline + AI consent

v87 BASELINE (current target — HOSTED, not bundled)
  UI born:  5762b16  SignedOutLanding "Find Your Memories" + Sign In
  Tip:      ${V87_TIP}  OAuth fix restorebraine.base44.app/api/apps/auth/*
  Tag:      v87-baseline
  HEAD:     ${head}

Architecture change Omega 3 → v87:
  Omega 3: bundled ios/public (capacitor://) — gallery in Mac build
  v87:     hosted ${HOSTED} — gallery in live Base44 App-*.js chunk

  → Omega 3 gallery code lives in GIT; iPhone sees it only after Base44 Publish.

CORRECTIONS applied after Omega 3 (on path to v87):
`);

for (const { sha, note } of OMEGA3_TO_V87_COMMITS) {
  console.log(`  ${sha.slice(0, 7)}  ${note}`);
}

console.log(`
BASE44 FULL PUBLISH (must include Omega 3 gallery stack)
  Files:   ${TIER_FULL.length} total (${TIER_GALLERY.length} gallery)
  Export:  npm run base44:export-pack
  Verify:  npm run verify:manifest
  Watch:   npm run align:watch  (until App chunk ≠ App-B4VcOATW.js)

WHY OLD "43 FILE" PUBLISH FAILED
  Manifest omitted PullToRefresh, PhotoModal, NavigationContext, media-organize.js
  Base44 kept stale copies → App-B4VcOATW.js never matched git v87 build

iPhone after Publish passes diagnose:chunks:
  Delete app → Restart iPhone → Xcode Clean → Run
  npm run prompt:replace-app

═══════════════════════════════════════════════════════════════
`);
