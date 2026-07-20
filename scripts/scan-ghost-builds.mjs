#!/usr/bin/env node
/**
 * Scan live Base44 CDN for ghost builds (old hashed assets still HTTP 200).
 * Writes ios/App/App/ghost-builds.txt for native purge + JS blocker.
 *
 * Usage: npm run ghosts:scan
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  HOSTED,
  KNOWN_GHOST_ASSETS,
  probeGhostAssets,
} from './ghost-builds-registry.mjs';

const { live, active, results } = await probeGhostAssets();

console.log(`
═══════════════════════════════════════════════════════════════
 GHOST BUILD SCAN — ${HOSTED}
═══════════════════════════════════════════════════════════════

LIVE ENTRYPOINT (canonical — what new clients should load):
  Index: ${live.indexName ?? '?'}
  App:   ${live.appName ?? '?'}
`);

const ghosts = results.filter((r) => r.isGhost);
const activeOnCdn = results.filter((r) => r.active && r.onCdn);

console.log('ACTIVE ON CDN (keep):');
for (const r of activeOnCdn) {
  console.log(`  ✓ ${r.file}`);
}

console.log('\nGHOST BUILDS (still on CDN — cannot delete from terminal):');
if (!ghosts.length) {
  console.log('  (none in registry — run after updating ghost-builds-registry.mjs)');
} else {
  for (const r of ghosts) {
    const meta = KNOWN_GHOST_ASSETS.find((g) => g.file === r.file);
    console.log(`  ✗ ${r.file}  HTTP ${r.status}  — ${meta?.note ?? 'stale'}`);
  }
}

console.log(`
CDN REALITY:
  Base44 keeps old content-hashed files forever (HTTP 200).
  Terminal cannot delete them — only Base44 platform could purge CDN.

WHAT WE DO INSTEAD:
  1. ios/App/App/ghost-builds.txt → native WKWebView cache purge + JS block
  2. Rebuild iOS app → BUILD_STAMP change wipes cached ghost JS on device
  3. npm run revert:terminal → bundled mode (no CDN at all)
`);

const ghostFiles = ghosts.map((g) => g.file);
const outPath = resolve('ios/App/App/ghost-builds.txt');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${ghostFiles.join('\n')}\n`);
console.log(`Wrote ${ghostFiles.length} ghost filenames → ${outPath}`);

process.exit(ghosts.length ? 1 : 0);
