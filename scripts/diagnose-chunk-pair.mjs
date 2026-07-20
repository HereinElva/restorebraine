#!/usr/bin/env node
/**
 * Detect mixed Base44 chunks — OAuth index bundle vs stale App chunk (formatting/blank UI).
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';

const HOSTED = 'https://restorebraine.base44.app';

function sha(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function gitBuildChunks() {
  const distIndex = 'dist/index.html';
  if (!existsSync(distIndex)) return null;
  const html = readFileSync(distIndex, 'utf8');
  const index = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
  if (!index || !existsSync(`dist/assets/${index}`)) return null;
  const indexJs = readFileSync(`dist/assets/${index}`, 'utf8');
  const app = indexJs.match(/assets\/(App-[^"]+\.js)/)?.[1]
    ?? indexJs.match(/(App-[A-Za-z0-9_-]+\.js)/)?.[1];
  if (!app || !existsSync(`dist/assets/${app}`)) return null;
  return {
    index,
    app,
    indexSha: sha(indexJs),
    appSha: sha(readFileSync(`dist/assets/${app}`, 'utf8')),
  };
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' CHUNK PAIR CHECK — index bundle must match App chunk (same Publish)');
console.log('═══════════════════════════════════════════════════════════════\n');

const git = gitBuildChunks();
if (git) {
  console.log(`Git v87 build (local dist):`);
  console.log(`  ${git.index}  sha ${git.indexSha}`);
  console.log(`  ${git.app}  sha ${git.appSha}`);
} else {
  console.log('Git v87 build: run npm run build:web first for comparison');
}

console.log('\nLive Base44:');
const html = await fetchText(HOSTED);
const liveIndexName = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1];
const liveIndex = await fetchText(`${HOSTED}/assets/${liveIndexName}`);
const liveAppName = liveIndex.match(/assets\/(App-[^"]+\.js)/)?.[1]
  ?? (liveIndex.match(/(App-[A-Za-z0-9_-]+\.js)/)?.[1] ?? null);
const liveApp = liveAppName ? await fetchText(`${HOSTED}/assets/${liveAppName}`) : '';
console.log(`  ${liveIndexName}  sha ${sha(liveIndex)}`);
console.log(`  ${liveAppName ?? '?'}  sha ${liveApp ? sha(liveApp) : '?'}`);

const issues = [];
if (git && liveAppName !== git.app) {
  issues.push(`App chunk mismatch: live ${liveAppName} ≠ git ${git.app}`);
}
if (git && liveIndexName !== git.index) {
  issues.push(`Index chunk mismatch: live ${liveIndexName} ≠ git ${git.index} (expected after full Publish)`);
}

console.log('\n───────────────────────────────────────────────────────────────');
if (issues.length) {
  console.log(' ✗ MIXED PUBLISH DETECTED (or Publish not done yet)');
  for (const i of issues) console.log(`   • ${i}`);
  console.log(`
WHY UI LOOKS WRONG (formatting off, blank gallery feel):
  Partial Base44 Publish updated OAuth in index-*.js but left App-*.js
  from an older build. Gallery, CSS imports, and layout live in App chunk.
  OAuth diagnostics pass while gallery/CSS are stale — "no change" on UI fixes.

If you ran base44:nuke-list but have NOT clicked Publish yet:
  → This failure is EXPECTED. Paste all 43 files → Publish ONCE → re-run this.

FIX (one full Publish — not OAuth-only):
  npm run base44:copy-commands   (or base44:export-pack)
  Paste ALL files in Base44 editor → Publish ONCE
  npm run diagnose:chunks
  Expect: live App chunk changes from App-B4VcOATW.js
`);
  process.exit(1);
}

console.log(' ✓ Live index + App chunks appear paired with git v87 build');
console.log('\nIf gallery still empty (0 photos): check Account tab email matches');
console.log('your Google account that had photos — OAuth may have signed into a different account.');
process.exit(0);
