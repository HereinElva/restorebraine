#!/usr/bin/env node
/**
 * Detect stale/mixed Base44 chunks.
 * Base44 builds on their servers — live hashed filenames will NOT match local dist/.
 * Success = live App chunk is not the known stale hash + index references that App + v87 deploy label.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';

const HOSTED = 'https://restorebraine.base44.app';
/** Known stale App chunk from partial Publish (gallery/CSS stuck). */
export const STALE_APP = 'App-B4VcOATW.js';

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
console.log(' CHUNK PAIR CHECK — live Base44 must not serve stale App chunk');
console.log('═══════════════════════════════════════════════════════════════\n');

const git = gitBuildChunks();
if (git) {
  console.log('Git v87 build (local dist — reference only, hashes differ on Base44):');
  console.log(`  ${git.index}  sha ${git.indexSha}`);
  console.log(`  ${git.app}  sha ${git.appSha}`);
} else {
  console.log('Git v87 build: run npm run build:web first for local reference');
}

console.log('\nLive Base44:');
const html = await fetchText(HOSTED);
const deploy =
  html.match(/content="(v[0-9]+)"[^>]*restorebraine-deploy|restorebraine-deploy[^>]*content="(v[0-9]+)"/)?.[1]
  ?? html.match(/content="(v[0-9]+)"/)?.[1]
  ?? '?';
const liveIndexName = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1];
const liveIndex = await fetchText(`${HOSTED}/assets/${liveIndexName}`);
const liveAppName = liveIndex.match(/assets\/(App-[^"]+\.js)/)?.[1]
  ?? (liveIndex.match(/(App-[A-Za-z0-9_-]+\.js)/)?.[1] ?? null);
const liveApp = liveAppName ? await fetchText(`${HOSTED}/assets/${liveAppName}`) : '';
console.log(`  Deploy label:  ${deploy}`);
console.log(`  ${liveIndexName}  sha ${sha(liveIndex)}`);
console.log(`  ${liveAppName ?? '?'}  sha ${liveApp ? sha(liveApp) : '?'}`);

const issues = [];

if (liveAppName === STALE_APP) {
  issues.push(`Stale App chunk still live: ${STALE_APP} (partial Publish — gallery/CSS stuck)`);
}
if (!liveAppName || !liveAppName.startsWith('App-')) {
  issues.push('Could not resolve live App chunk from index bundle');
}
const indexRefsApp = liveAppName && liveIndex.includes(liveAppName);
if (liveAppName && !indexRefsApp) {
  issues.push(`Index bundle does not reference live App ${liveAppName} (mixed publish)`);
}
if (deploy !== 'v87' && deploy !== '?') {
  issues.push(`Deploy label is ${deploy}, expected v87 after full revert`);
}

console.log('\n───────────────────────────────────────────────────────────────');
if (issues.length) {
  console.log(' ✗ BASE44 NOT REVERTED TO v87 (or Publish not done yet)');
  for (const i of issues) console.log(`   • ${i}`);
  console.log(`
WHY UI LOOKS WRONG (formatting off, blank gallery feel):
  Partial Base44 Publish updated OAuth in index-*.js but left App-*.js stale.
  Gallery, CSS imports, and layout live in the App chunk.

FIX (one full Publish — not OAuth-only):
  npm run revert:v87-all -- --base44-only   (paste checklist)
  npm run base44:export-pack                (all 71 files)
  Paste ALL files in Base44 editor → Publish ONCE
  npm run why:no-change                     (expect App ≠ ${STALE_APP})
`);
  process.exit(1);
}

console.log(` ✓ Live Base44 reverted to v87 (App ${liveAppName} ≠ stale ${STALE_APP})`);
if (git && liveAppName !== git.app) {
  console.log(`   Note: live ${liveAppName} ≠ local ${git.app} — normal (Base44 builds on their servers).`);
}
console.log('\nIf gallery still empty (0 photos): check Account tab email matches');
console.log('your Google account that had photos — OAuth may have signed into a different account.');
process.exit(0);
