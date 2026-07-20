#!/usr/bin/env node
/**
 * Scan git + Capacitor + live Base44 for post-v87 lingering artifacts.
 * Read-only unless --strict exits 1 on any finding.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  POST_V87_FORBIDDEN,
  POST_V87_FORBIDDEN_PATHS,
  HOSTED,
} from './base44-v87-publish-manifest.mjs';

const strict = process.argv.includes('--strict');
const issues = [];
const ok = [];

function fail(msg) { issues.push(msg); }
function pass(msg) { ok.push(msg); }

function scanText(label, text) {
  for (const { pattern, label: era } of POST_V87_FORBIDDEN) {
    if (text.includes(pattern)) fail(`${label} contains post-v87 "${pattern}" (${era})`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' POST-v87 LINGERING ARTIFACT SCAN');
console.log('═══════════════════════════════════════════════════════════════\n');

// Git forbidden paths
console.log('1. GIT — forbidden post-v87 files');
for (const rel of POST_V87_FORBIDDEN_PATHS) {
  if (existsSync(rel)) fail(`Still present: ${rel}`);
  else pass(`Absent: ${rel}`);
}

// Git source scan (key files)
console.log('\n2. GIT — post-v87 patterns in v87 source');
const scanFiles = [
  'src/App.jsx',
  'index.html',
  'capacitor.config.json',
  'ios/App/App/capacitor.config.json',
  'ios/App/App/AppDelegate.swift',
];
for (const f of scanFiles) {
  if (!existsSync(f)) continue;
  const before = issues.length;
  scanText(f, readFileSync(f, 'utf8'));
  if (issues.length === before) pass(`${f} clean`);
}

const cap = existsSync('ios/App/App/capacitor.config.json')
  ? readFileSync('ios/App/App/capacitor.config.json', 'utf8')
  : '';
if (cap.includes('appStartPath')) fail('ios capacitor.config.json has appStartPath (bundled mode — post-v87)');
else if (cap) pass('No appStartPath — hosted mode');

// Mac ios/public bundle
console.log('\n3. CAPACITOR — ios/App/App/public bundles');
const pubIndex = 'ios/App/App/public/index.html';
if (existsSync(pubIndex)) {
  const html = readFileSync(pubIndex, 'utf8');
  const mainJs = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
  if (mainJs && existsSync(`ios/App/App/public/assets/${mainJs}`)) {
    const js = readFileSync(`ios/App/App/public/assets/${mainJs}`, 'utf8');
    const broken = /\$\{dt\}\$\{e\}/.test(js) || (/\$\{it\}\$\{e\}/.test(js) && js.includes('app.base44.com'));
    const fixed = js.includes('restorebraine.base44.app/api/apps/auth') || js.includes('fe="https://restorebraine.base44.app"');
    if (broken) fail(`Mac fallback ${mainJs} has pre-f1b2505 OAuth — run mac-ios-setup after nuke`);
    else if (fixed) pass(`Mac fallback ${mainJs} OAuth OK`);
    scanText(mainJs, js);
  }
  // Orphan stale asset files from post-v87 builds
  const assetsDir = 'ios/App/App/public/assets';
  if (existsSync(assetsDir)) {
    const count = readdirSync(assetsDir).filter((f) => f.endsWith('.js')).length;
    if (count > 25) fail(`${count} JS chunks in ios/public — likely post-v87 build debris (nuke.sh cleans this)`);
    else pass(`ios/public assets: ${count} JS files`);
  }
} else {
  pass('No ios/public yet (will be rebuilt by mac-ios-setup)');
}

// Live Base44
console.log('\n4. LIVE BASE44 — post-v87 live bundle');
try {
  const html = await (await fetch(HOSTED, { headers: { 'cache-control': 'no-cache' } })).text();
  const bundle = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1];
  console.log(`   Live bundle: ${bundle ?? '?'}`);
  if (bundle) {
    const js = await (await fetch(`${HOSTED}/assets/${bundle}`, { headers: { 'cache-control': 'no-cache' } })).text();
    if (/\$\{dt\}\$\{e\}/.test(js)) {
      fail(`Live ${bundle} = pre-f1b2505 OAuth — Base44 Publish required (nuke Tier OAUTH minimum)`);
    } else if (js.includes('restorebraine.base44.app/api/apps/auth') || js.includes('fe="https://restorebraine.base44.app"')) {
      pass(`Live ${bundle} OAuth fixed`);
    }
    scanText(`live ${bundle}`, js);
    if (js.includes('NativeLoginCard') || js.includes('SignInScreen') || js.includes('NativeLoginProviders')) {
      fail('Live bundle contains post-v87 login components');
    }
  }
} catch (e) {
  fail(`Cannot probe live Base44: ${e.message}`);
}

// Git ancestry
console.log('\n5. GIT — commit ancestry');
try {
  execSync('git merge-base --is-ancestor f1b2505 HEAD', { stdio: 'ignore' });
  pass('HEAD is based on v87 tip f1b2505');
} catch {
  fail('HEAD not based on f1b2505 — run: git reset --hard v87-baseline');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' VERDICT');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of issues) console.log(`  ✗ ${m}`);

if (issues.length) {
  console.log(`
NUKE ORDER (all three layers):
  Mac:   bash scripts/nuke-v87.sh
  Base44: npm run base44:nuke-list  → paste ALL → Publish
  Verify: npm run verify:lingering && npm run diagnose:all
`);
  if (strict) process.exit(1);
} else {
  console.log('\n  No post-v87 lingering artifacts detected.\n');
}
