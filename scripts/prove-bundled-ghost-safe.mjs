#!/usr/bin/env node
/**
 * Fail if the current bundled entry is in ghost-builds BLOCK list —
 * stale bundle blockers prevent new Mac builds from loading on iPhone.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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

const indexHtml = read('ios/App/App/public/index.html');
const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
const assetsDir = resolve('ios/App/App/public/assets');
const appJs = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.startsWith('App-') && f.endsWith('.js'))
  : [];

if (!entry) {
  console.error('✗ No bundled entry in ios/App/App/public/index.html — run npm run build:native-local');
  process.exit(1);
}

const { block, allow } = parseGhostLists(read('ios/App/App/ghost-builds.txt'));
const bundled = [entry, ...appJs];
const blocked = bundled.filter((f) => block.includes(f) && !allow.includes(f));

if (blocked.length) {
  console.error('✗ Bundled build is GHOST-BLOCKED (old build blocking new one on device):');
  for (const f of blocked) console.error(`    ${f}`);
  console.error('  Fix: npm run ghosts:sync && npm run apply:v87-from-omega3');
  process.exit(1);
}

console.log(`✓ Bundled entry allowed: ${entry}`);
if (appJs[0]) console.log(`✓ Bundled App allowed: ${appJs[0]}`);
console.log('  Stale WKWebView bundles remain blocklisted; this build is not.');
