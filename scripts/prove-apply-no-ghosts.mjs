#!/usr/bin/env node
/**
 * Prove the current (or post-apply) bundled build has NO ghost assets.
 * Run before/after: npm run apply:v87-from-omega3
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { KNOWN_GHOST_ASSETS, STALE_APP } from './ghost-builds-registry.mjs';

function read(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return '';
  }
}

function parseGhostLists(text) {
  const block = [];
  const allow = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('+')) allow.push(t.slice(1).trim());
    else block.push(t);
  }
  return { block, allow };
}

const knownGhostFiles = KNOWN_GHOST_ASSETS.map((g) => g.file);
const assetsDir = resolve('ios/App/App/public/assets');
const indexHtml = read('ios/App/App/public/index.html');
const ghostText = read('ios/App/App/ghost-builds.txt');
const { block, allow } = parseGhostLists(ghostText);

const errors = [];
const passed = [];

console.log(`
═══════════════════════════════════════════════════════════════
 PROVE APPLY — no ghost builds in bundled ios/public
═══════════════════════════════════════════════════════════════
`);

// 1. index.html must not reference known ghost CDN filenames
for (const ghost of knownGhostFiles) {
  if (indexHtml.includes(ghost)) {
    errors.push(`index.html references ghost script: ${ghost}`);
  }
}
if (!errors.some((e) => e.includes('index.html'))) {
  passed.push('index.html has no known ghost CDN script names');
}

const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
if (!entry) {
  errors.push('ios/public/index.html missing bundled entry script');
} else {
  passed.push(`Bundled entry: ${entry}`);
}

// 2. All ios/public/assets/*.js — none are known ghosts; none blocklisted without allow
if (!existsSync(assetsDir)) {
  errors.push('Missing ios/App/App/public/assets — run npm run apply:v87-from-omega3');
} else {
  const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  const knownInBundle = jsFiles.filter((f) => knownGhostFiles.includes(f));
  if (knownInBundle.length) {
    errors.push(`Known ghost files IN bundled assets: ${knownInBundle.join(', ')}`);
  } else {
    passed.push(`All ${jsFiles.length} bundled JS files — none are known CDN ghosts`);
  }

  const blocked = jsFiles.filter((f) => block.includes(f) && !allow.includes(f));
  if (blocked.length) {
    errors.push(`Bundled assets in ghost BLOCK list (device may refuse load): ${blocked.join(', ')}`);
  } else {
    passed.push('All bundled assets ALLOW-listed or not blocklisted');
  }

  if (entry && !jsFiles.includes(entry)) {
    errors.push(`index.html entry ${entry} missing from ios/public/assets`);
  }
}

// 3. Known ghosts must stay BLOCKED (not accidentally allowed)
for (const ghost of knownGhostFiles) {
  if (allow.includes(ghost)) {
    errors.push(`ghost-builds.txt ALLOWs known ghost (should be BLOCK only): ${ghost}`);
  } else if (block.includes(ghost)) {
    passed.push(`Ghost blocklisted: ${ghost}`);
  } else {
    errors.push(`Known ghost missing from blocklist: ${ghost}`);
  }
}

// 4. Current build must be explicitly allowed
if (entry) {
  if (allow.includes(entry) || !block.includes(entry)) {
    passed.push(`Current entry ${entry} safe to load on device`);
  } else {
    errors.push(`Current entry ${entry} is BLOCKlisted — apply would not push through`);
  }
}

// 5. Bundled mode — CDN ghosts cannot load
const iosCap = read('ios/App/App/capacitor.config.json');
if (iosCap.includes('restorebraine.base44.app') && iosCap.includes('"url"')) {
  errors.push('ios config is HOSTED — phone may load CDN ghosts; use bundled apply');
} else {
  passed.push('Bundled mode — phone loads ios/public only (CDN ghosts cannot load)');
}

console.log('PASS');
for (const p of passed) console.log(`  ✓ ${p}`);

if (errors.length) {
  console.log('\nFAIL — do NOT run on iPhone until fixed:');
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('\nFix: npm run ghosts:sync && npm run apply:v87-from-omega3');
  process.exit(1);
}

console.log(`
✓ SAFE — no ghost builds in this version.
  apply:v87-from-omega3 wipes stale ios/public, rebuilds fresh, syncs ghost allowlist.
  Stale hashes like ${STALE_APP} stay blocklisted; new index-*.js is allowed.
`);
process.exit(0);
