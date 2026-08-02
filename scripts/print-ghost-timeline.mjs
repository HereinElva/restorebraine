#!/usr/bin/env node
/**
 * Timeline: Omega 3 → v87 corrections → ghost build obstructions.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { OMEGA3_TO_V87_COMMITS, OMEGA3_TAG, V87_TIP } from './base44-v87-publish-manifest.mjs';
import { KNOWN_GHOST_ASSETS, STALE_APP } from './ghost-builds-registry.mjs';

function git(args) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

let discoverCount = '?';
let discoverList = [];
const reportPath = resolve('reports/ghost-builds-report.json');
if (existsSync(reportPath)) {
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    discoverCount = report.ghosts?.length ?? '?';
    discoverList = report.ghosts ?? [];
  } catch {
    /* ignore */
  }
}

const historyIndices = git('log omega-3..HEAD --all -p 2>/dev/null | grep -oE "index-[A-Za-z0-9_-]+\\.js" | sort -u | wc -l').trim();
const historyApps = git('log omega-3..HEAD --all -p 2>/dev/null | grep -oE "App-[A-Za-z0-9_-]+\\.js" | sort -u | wc -l').trim();

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' GHOST BUILD TIMELINE — Omega 3 → v87 → now');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`OMEGA 3 (${OMEGA3_TAG}) — bundled v261, gallery/organize reference`);
console.log('  Phone loaded: Mac ios/public (capacitor://)');
console.log('  Base44 CDN:   hosted URL existed but bundled was primary');
console.log('');
console.log('CORRECTIONS Omega 3 → v87 (hosted architecture):');

for (const { sha, note } of OMEGA3_TO_V87_COMMITS) {
  console.log(`  ${sha.slice(0, 7)}  ${note}`);
}

console.log('');
console.log(`v87 tip (${V87_TIP}) — hosted Capacitor, UI from live Base44 Publish`);
console.log('');
console.log('WHERE GHOSTS CAME FROM (partial Publish pattern):');
console.log('  Multiple index/App publishes left stale chains on CDN.');
console.log(`  Deploy meta said v87 while App chunk stayed ${STALE_APP}.`);
console.log('');
console.log('FULL CDN SCAN — run npm run ghosts:discover for live count:');
console.log(`  Git history since Omega 3: ${historyIndices} unique index hashes · ${historyApps} App hashes`);
console.log('  Typical CDN result: ~571 index + ~83 App return 404 (already gone)');
console.log(`  Still blocking cached phones: ${discoverCount} ghosts — see ghost-builds.txt`);
console.log('');
console.log('PRIMARY GHOST CHAINS (confirmed obstructions):');

for (const { file, note } of KNOWN_GHOST_ASSETS) {
  console.log(`  ✗ ${file.padEnd(22)} ${note}`);
}

if (discoverList.length > KNOWN_GHOST_ASSETS.length) {
  console.log('');
  console.log('ADDITIONAL GHOSTS from chain expansion (npm run ghosts:discover):');
  for (const g of discoverList) {
    if (!KNOWN_GHOST_ASSETS.some((k) => k.file === g.file)) {
      const via = g.linkedFrom ? ` via ${g.linkedFrom}` : '';
      console.log(`  ✗ ${g.file}${via}`);
    }
  }
}

console.log('');
console.log('  LIVE correct entry: index-BtNzh8Fh.js → App-DvoqTTOC.js');
console.log('');
console.log('COMMANDS:');
console.log('  npm run ghosts:discover    Refresh scan + update ghost-builds.txt');
console.log('  npm run ghosts:eliminate   Device purge + blocklist rebuild');
console.log('  npm run ghosts:audit-all   Full GitHub + Capacitor + Base44 audit');
console.log('  npm run revert:terminal    Bundled mode — bypasses CDN entirely');
console.log('');
console.log(`HEAD: ${git('rev-parse --short HEAD')}`);
console.log('═══════════════════════════════════════════════════════════════');
