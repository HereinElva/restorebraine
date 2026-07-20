#!/usr/bin/env node
/**
 * Print complete Base44 paste checklist to wipe post-v87 live JS.
 * Base44 has no "delete file" — overwrite every source file, then Publish once.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TIER_OAUTH,
  TIER_APP_SHELL,
  TIER_FULL,
  HOSTED,
  V87_TIP,
} from './base44-v87-publish-manifest.mjs';

const sha = (rel) => {
  try {
    return createHash('sha256').update(readFileSync(resolve(rel))).digest('hex').slice(0, 12);
  } catch {
    return 'MISSING';
  }
};

const tier = process.argv.includes('--oauth-only')
  ? TIER_OAUTH
  : process.argv.includes('--minimal')
    ? [...new Set([...TIER_OAUTH, ...TIER_APP_SHELL])]
    : TIER_FULL;

console.log(`
═══════════════════════════════════════════════════════════════
 BASE44 NUKE CHECKLIST — wipe post-v87 live JS (v87 = ${V87_TIP})
═══════════════════════════════════════════════════════════════

WHY FULL PUBLISH IS REQUIRED
  Past failures published index.html or static JS only → deploy meta said v87
  but main bundle stayed index-CLtZjYMv.js with broken OAuth.
  Base44 rebuilds index-*.js from SOURCE files in the editor — not from GitHub.

STEPS
  1. Open https://app.base44.com → Restorebraine → Code editor
  2. For EACH file below: open path in editor → paste FULL contents from Mac
  3. After ALL files pasted → click Publish (top right) ONCE
  4. Mac: npm run diagnose:sync  (bundle hash MUST change)
  5. Mac: npm run verify:lingering -- --strict

Files to paste (${tier.length} total):
`);

let n = 0;
for (const rel of tier) {
  n += 1;
  const exists = existsSync(rel);
  const marker = !exists ? ' ✗ MISSING ON DISK' : '';
  console.log(`  ${String(n).padStart(3)}. ${rel}${marker}`);
  console.log(`       sha256: ${sha(rel)}  ← verify after paste`);
}

console.log(`
PASTE FROM MAC (example):
  cat ~/restorebraine/src/lib/native-platform-guard.js | pbcopy

MINIMUM IF SHORT ON TIME (Sign In only — may not wipe all post-v87 UI):
  npm run base44:nuke-list -- --minimal

AFTER PUBLISH — success looks like:
  • Live bundle hash ≠ index-CLtZjYMv.js
  • npm run diagnose:oauth → Live row = restorebraine.base44.app
  • npm run diagnose:all → 5/5 passed

THEN iPhone:
  Delete app → Restart iPhone → Xcode Clean → Run

  DO NOT paste post-v87 files (delete from Base44 editor if present):
  NativeLoginCard, SignInScreen, NativeLoginProviders,
  NativePlatformLoginRedirect, native-shell-stabilizer.js
═══════════════════════════════════════════════════════════════
`);
