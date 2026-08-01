#!/usr/bin/env node
/**
 * Full three-layer ghost/remnant audit — GitHub + Capacitor + Base44 CDN.
 * Target lineage: Omega 3 gallery → v87 corrections (f1b2505). No post-v87 artifacts.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { discoverGhostBuilds } from './discover-ghost-builds.mjs';
import { STALE_APP, HOSTED } from './ghost-builds-registry.mjs';

const issues = [];
const ok = [];
const warn = [];

function pass(msg) { ok.push(msg); }
function fail(msg) { issues.push(msg); }
function note(msg) { warn.push(msg); }

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function grepRepo(pattern) {
  try {
    return execSync(`git grep -l "${pattern}" -- ':!node_modules' ':!dist' ':!ios/App/App/public' 2>/dev/null || true`, {
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' FULL GHOST BUILD AUDIT — GitHub + Capacitor + Base44');
console.log(' Target: Omega 3 → v87 only. No post-v87 remnants.');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ── LAYER 1: GitHub ─────────────────────────────────────────────────────────
console.log('▶ LAYER 1 — GitHub source tree');

try {
  execSync('node scripts/verify-v87-baseline.mjs', { stdio: 'pipe' });
  pass('v87 baseline verified (app = f1b2505, UI = 5762b16)');
} catch {
  fail('GitHub not on v87 baseline — run git reset --hard origin/cursor/apple-privacy-plist-bacf');
}

try {
  execSync('node scripts/verify-no-post-v87-lingering.mjs --strict', { stdio: 'pipe' });
  pass('No post-v87 forbidden files (NativeLoginCard, SignInScreen, bridge VC, etc.)');
} catch {
  fail('Post-v87 artifacts still in git — run npm run verify:lingering -- --strict');
}

const ghostRefsInSrc = grepRepo('App-B4VcOATW|index-CLtZjYMv|App-BMryy2H5|index-CJJVGreG');
const srcRefs = ghostRefsInSrc.filter((f) => f.startsWith('src/') || f === 'index.html');
if (srcRefs.length) {
  fail(`Ghost CDN filenames referenced in source: ${srcRefs.join(', ')}`);
} else {
  pass('No ghost CDN filenames hardcoded in src/ or index.html');
}

const scriptRefs = ghostRefsInSrc.filter((f) => f.startsWith('scripts/'));
if (scriptRefs.length) {
  note(`Ghost filenames in diagnostic scripts only (OK): ${scriptRefs.length} files`);
}

// ── LAYER 2: Capacitor ──────────────────────────────────────────────────────
console.log('');
console.log('▶ LAYER 2 — Capacitor native shell');

const capRoot = readJson('capacitor.config.json');
const capIos = readJson('ios/App/App/capacitor.config.json');

if (capRoot?.server?.appStartPath || capIos?.server?.appStartPath) {
  fail('appStartPath set — bundled flip-flop mode');
} else if (capRoot?.server?.url?.includes('restorebraine.base44.app')) {
  note('Hosted mode: WKWebView loads live Base44 (ghost blocklist + cache purge active)');
  pass('Capacitor hosted → restorebraine.base44.app');
} else if (!capRoot?.server?.url && !capIos?.server?.url) {
  pass('Bundled mode: phone loads ios/public only — CDN ghosts cannot load');
  note('Bundled entry — no Base44 CDN involved');
} else {
  fail(`Unexpected Capacitor server config: ${capRoot?.server?.url ?? 'none'}`);
}

const pubAssets = resolve('ios/App/App/public/assets');
if (existsSync(pubAssets)) {
  const jsFiles = readdirSync(pubAssets).filter((f) => f.endsWith('.js'));
  const ghostInBundle = jsFiles.filter((f) =>
    f === 'App-B4VcOATW.js' || f === 'App-BMryy2H5.js' || f.startsWith('index-CLtZjYMv'),
  );
  if (ghostInBundle.length) {
    fail(`Ghost CDN filenames in ios/public: ${ghostInBundle.join(', ')}`);
  } else {
    pass(`ios/public/assets: ${jsFiles.length} JS files — no known ghost CDN names`);
  }

  const indexHtml = readFileSync(resolve('ios/App/App/public/index.html'), 'utf8');
  const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
  pass(`Mac bundled entry: ${entry}`);
} else {
  note('ios/public/assets missing — run npm run build or build:native-local');
}

const ghostBlockPath = resolve('ios/App/App/ghost-builds.txt');
if (existsSync(ghostBlockPath)) {
  const blocklist = readFileSync(ghostBlockPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('+'));
  pass(`ghost-builds.txt blocklist: ${blocklist.length} CDN files blocked on device`);
} else {
  warn.push('ghost-builds.txt missing — run npm run ghosts:discover');
}

if (existsSync('ios/App/App/AppDelegate.swift')) {
  const delegate = readFileSync('ios/App/App/AppDelegate.swift', 'utf8');
  if (delegate.includes('purgeGhostBuildCacheIfNeeded') && delegate.includes('purgeGhostBuilds')) {
    pass('AppDelegate: WKWebView cache purge + JS ghost blocker installed');
  } else {
    fail('AppDelegate missing ghost purge — pull latest branch');
  }
}

// ── LAYER 3: Base44 CDN ─────────────────────────────────────────────────────
console.log('');
console.log('▶ LAYER 3 — Base44 live CDN');

const report = await discoverGhostBuilds();
console.log(`  Live entry: ${report.live.index} → ${report.live.app}`);
console.log(`  CDN ghosts: ${report.stats.cdnGhosts ?? 0} stale files still HTTP 200`);
console.log(`  Device blocklist: ${report.stats.deviceBlocklist ?? report.deviceBlocklist?.length ?? '?'} WKWebView cache blockers`);
console.log(`  CDN gone:   ${report.stats.gone404} candidates return 404`);

if (report.live.app === STALE_APP) {
  fail(`Live site still serves stale ${STALE_APP} — Base44 Publish required`);
} else {
  pass(`Live App is NOT stale ${STALE_APP}`);
}

if (report.stats.cdnGhosts === 0) {
  pass('No stale ghost assets on CDN (live tree OK)');
} else {
  note(`${report.stats.cdnGhosts} stale files still HTTP 200 on CDN`);
  for (const g of report.cdnGhosts ?? report.ghosts.filter((x) => x.onCdn)) {
    console.log(`    ✗ ${g.file}${g.linkedFrom ? ` (${g.linkedFrom})` : ''}`);
  }
  note('Device fix: npm run ghosts:eliminate + Delete app + Restart iPhone + Xcode Clean → Run');
}

if (report.deviceBlocklist?.length) {
  pass(`Device blocklist: ${report.deviceBlocklist.length} cached stale bundles blocked (not live deps)`);
  if (report.deviceBlocklist.includes('index-Dzn3_rKv.js')) {
    fail('BLOCKLIST BUG: index-Dzn3_rKv.js is a LIVE dependency — would break app');
  }
}

// Live deploy meta
try {
  const html = await fetch(HOSTED, { headers: { 'cache-control': 'no-cache' } }).then((r) => r.text());
  const deploy = html.match(/content="(v[0-9]+)"[^>]*restorebraine-deploy|restorebraine-deploy[^>]*content="(v[0-9]+)"/)?.[1]
    ?? html.match(/content="(v[0-9]+)"/)?.[1] ?? '?';
  if (deploy === 'v87') {
    pass('Live deploy meta = v87');
  } else {
    note(`Live deploy meta = ${deploy} (expected v87 for hosted target)`);
  }
} catch {
  fail('Could not fetch live Base44');
}

// ── VERDICT ─────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' VERDICT');
console.log('═══════════════════════════════════════════════════════════════');

for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of warn) console.log(`  ⚠ ${m}`);
for (const m of issues) console.log(`  ✗ ${m}`);

console.log('');
if (issues.length) {
  console.log(`BLOCKED — ${issues.length} issue(s) must be fixed.`);
  process.exit(2);
}

if (report.stats.ghosts > 0) {
  console.log('GitHub + Capacitor CLEAN. CDN ghosts blocked on device (cannot delete from server).');
  console.log('Next: npm run ghosts:eliminate → Xcode Delete app → Clean → Run');
  process.exit(1);
}

console.log('ALL LAYERS CLEAN — no ghost obstructions detected.');
process.exit(0);
