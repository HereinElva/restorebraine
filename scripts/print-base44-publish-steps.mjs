#!/usr/bin/env node
/** Print Base44 Publish steps — safe to read; do NOT paste this whole block into zsh. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const build = readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '87';
const pack = process.argv.includes('--full')
  ? 'BASE44-PASTE-PACK-v87.txt (79 files — login + Omega 3 gallery)'
  : 'BASE44-LOGIN-PACK-v87.txt (18 files — Sign In + signed-out landing first)';

console.log(`
══════════════════════════════════════════════════════════════
 BASE44 PUBLISH — required for iPhone UI to change (hosted mode)
══════════════════════════════════════════════════════════════

IMPORTANT: npm run base44:export-pack only writes a file on your Mac.
It does NOT update the live site. The iPhone loads restorebraine.base44.app
until you Publish in the Base44 browser editor.

── STEP 1 — Open Base44 code editor ──
  1. Open https://app.base44.com in Safari or Chrome
  2. Open the Restorebraine app
  3. Click Code (editor)

── STEP 2 — Paste files from Mac ──
  4. Open this file on your Mac in TextEdit or VS Code:
       ~/restorebraine/${pack.split(' ')[0]}
  5. For each block that starts with "FILE: path/to/file"
     copy the file contents into the matching path in Base44 editor
  6. Save each file in Base44 (editor save, not Mac save)

  Tip: Start with login pack (18 files) if Sign In is broken.
       Use full pack (79 files) for Omega 3 gallery improvements.

── STEP 3 — Publish once ──
  7. Click Publish (top right in Base44 editor)
  8. Wait until Publish completes (usually 30–90 seconds)

── STEP 4 — Verify on Mac (run these in Terminal) ──
  npm run prove:live-publish
  npm run prove:live-oauth
  npm run diagnose:auth-flow

── STEP 5 — Refresh iPhone ──
  Delete Restorebraine app → Restart iPhone → Xcode Clean → Run

Expected deploy stamp after publish: v${build}

If Sign In still does nothing: live index.html may still have inline login guard.
Publishing index.html from the pack removes it (uses login-redirect.js only).

Do NOT type lines starting with # into Terminal — zsh will error.
══════════════════════════════════════════════════════════════
`);
