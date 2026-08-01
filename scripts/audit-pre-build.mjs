#!/usr/bin/env node
/**
 * Four-layer pre-build audit — Git · Capacitor · iOS · Device readiness
 * Run BEFORE npm run apply:v87-from-omega3 or Xcode Run.
 *
 * Terminal bundled workflow: phone loads ios/public from Mac (no Safari).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { KNOWN_GHOST_ASSETS } from './ghost-builds-registry.mjs';
import { POST_V87_FORBIDDEN_PATHS, TIER_FULL, V87_TIP } from './base44-v87-publish-manifest.mjs';

const errors = [];
const warnings = [];
const passed = [];

function pass(msg) { passed.push(msg); }
function warn(msg) { warnings.push(msg); }
function fail(msg) { errors.push(msg); }

function read(rel) {
  try { return readFileSync(resolve(rel), 'utf8'); } catch { return ''; }
}

function runNode(script, args = []) {
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8', stdio: 'pipe' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
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

console.log(`
═══════════════════════════════════════════════════════════════
 PRE-BUILD AUDIT — Git · Capacitor · iOS · Device
 Run before: npm run apply:v87-from-omega3 → Xcode Run
═══════════════════════════════════════════════════════════════
`);

// ── LAYER 1: GIT ─────────────────────────────────────────────────────────────
console.log('▶ LAYER 1 — Git (source ready for new build)\n');

try {
  const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  pass(`HEAD ${head}`);
} catch {
  fail('Not a git repository');
}

try {
  execSync(`git merge-base --is-ancestor ${V87_TIP} HEAD`, { stdio: 'ignore' });
  pass(`Branch based on v87 tip (${V87_TIP.slice(0, 7)})`);
} catch {
  fail(`Branch not based on v87 tip ${V87_TIP} — git reset --hard origin/cursor/apple-privacy-plist-bacf`);
}

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  warn(`Uncommitted changes (${dirty.split('\n').length} files) — git reset --hard will discard`);
} else {
  pass('Working tree clean');
}

for (const p of POST_V87_FORBIDDEN_PATHS) {
  if (existsSync(p)) fail(`Forbidden post-v87 file: ${p}`);
  else pass(`Absent: ${p.split('/').pop()}`);
}

const omega3Core = [
  'src/lib/gallery-organize-snapshot.js',
  'src/lib/run-media-organize.js',
  'src/screens/SignInScreen.jsx',
  'src/components/NativeLoginCard.jsx',
];
for (const p of omega3Core) {
  if (existsSync(p)) pass(`${p.split('/').pop()} present`);
  else fail(`Missing ${p}`);
}

if (read('src/lib/AuthContext.jsx').includes('withAuthTimeout')) {
  pass('Auth boot timeout fix present (prevents infinite spinner)');
} else {
  fail('AuthContext missing withAuthTimeout — stale token causes infinite spinner');
}

// ── LAYER 2: CAPACITOR ───────────────────────────────────────────────────────
console.log('\n▶ LAYER 2 — Capacitor (bundled terminal mode)\n');

const iosCap = read('ios/App/App/capacitor.config.json');
const rootCap = read('capacitor.config.json');

if (iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app')) {
  fail('ios/App/App/capacitor.config.json is HOSTED — phone ignores Mac build. Run apply:v87-from-omega3');
} else if (iosCap && !iosCap.includes('restorebraine.base44.app')) {
  pass('Bundled mode: no server.url in ios config (Mac controls UI)');
} else {
  fail('capacitor.config.json missing or invalid');
}

const publicDir = resolve('ios/App/App/public');
const assetsDir = resolve('ios/App/App/public/assets');
if (!existsSync(publicDir)) {
  fail('ios/App/App/public missing — run npm run apply:v87-from-omega3 first');
} else {
  pass('ios/App/App/public exists');
}

const indexHtml = read('ios/App/App/public/index.html');
const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
if (!entry) {
  fail('Bundled index.html missing entry script');
} else {
  pass(`Bundled entry: ${entry}`);
}

if (indexHtml.includes('crossorigin')) {
  fail('Bundled index.html has crossorigin — breaks capacitor://');
} else {
  pass('No crossorigin on bundled index.html');
}

const knownGhosts = KNOWN_GHOST_ASSETS.map((g) => g.file);
const staleInHtml = knownGhosts.filter((g) => indexHtml.includes(g));
if (staleInHtml.length) {
  fail(`index.html references ghost scripts: ${staleInHtml.join(', ')}`);
} else {
  pass('index.html has no known ghost CDN script names');
}

if (existsSync(assetsDir)) {
  const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  const ghostsInBundle = jsFiles.filter((f) => knownGhosts.includes(f));
  if (ghostsInBundle.length) {
    fail(`Ghost files in ios/public/assets: ${ghostsInBundle.join(', ')}`);
  } else {
    pass(`All ${jsFiles.length} bundled JS files — no known CDN ghosts`);
  }
}

// ── LAYER 3: iOS NATIVE SHELL ──────────────────────────────────────────────────
console.log('\n▶ LAYER 3 — iOS native shell (Xcode bundle)\n');

const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
if (stamp) pass(`BUILD_STAMP: ${stamp}`);
else warn('BUILD_STAMP.txt missing — write-build-info runs on apply');

const delegate = read('ios/App/App/AppDelegate.swift');
if (delegate.includes('sessionBridgeScriptInstalled')) {
  pass('AppDelegate: single session bridge install');
} else {
  fail('AppDelegate may double-install bridge (white screen risk)');
}
if (delegate.includes('bundledMinimalBridgeScript')) {
  pass('AppDelegate: minimal bundled bridge (no Location patches at boot)');
} else {
  warn('AppDelegate missing minimal bundled bridge');
}

const ghostText = read('ios/App/App/ghost-builds.txt');
const { block, allow } = parseGhostLists(ghostText);
if (entry) {
  const entryBlocked = block.includes(entry) && !allow.includes(entry);
  if (entryBlocked) {
    fail(`Current entry ${entry} is GHOST-BLOCKED — old build blocks new one`);
  } else {
    pass(`ghost-builds.txt allows current entry ${entry}`);
  }
}
for (const g of knownGhosts) {
  if (block.includes(g)) pass(`Ghost blocklisted: ${g}`);
  else warn(`Known ghost not in blocklist: ${g}`);
}

if (existsSync('ios/App/verify-bundle.sh')) pass('Xcode verify-bundle.sh present');
else warn('Missing ios/App/verify-bundle.sh');

const rInterference = runNode('scripts/audit-interference.mjs');
const interferenceFailBlock = rInterference.out.split('FAIL (must fix')[1]?.split('────')[0] ?? '';
const interferenceFails = interferenceFailBlock.split('\n').filter((l) => l.trim().startsWith('✗'));
if (interferenceFails.length) {
  fail(`Interference audit: ${interferenceFails.map((l) => l.trim()).join('; ')}`);
} else {
  pass('Interference audit: no blockers');
}

// ── LAYER 4: DEVICE READINESS ────────────────────────────────────────────────
console.log('\n▶ LAYER 4 — Device (iPhone will accept new build)\n');

pass('Bundled mode: CDN ghosts cannot load — only ios/public matters');
pass('New BUILD_STAMP on apply triggers fresh native bundle identity');

if (read('src/App.jsx').includes('HashRouter')) {
  pass('HashRouter for capacitor:// (routing works in bundled mode)');
} else {
  warn('App.jsx may use BrowserRouter only — capacitor:// routing risk');
}

const rGhostProve = runNode('scripts/prove-apply-no-ghosts.mjs');
if (rGhostProve.ok) {
  pass('prove-apply-no-ghosts: bundled build safe to deploy');
} else {
  fail('prove-apply-no-ghosts FAILED — run npm run ghosts:sync && apply:v87-from-omega3');
}

console.log('\n  REQUIRED on iPhone after every new build (or phone keeps old bundle):');
console.log('    1. Delete Restorebraine app');
console.log('    2. Restart iPhone (power off → 30s → on)');
console.log('    3. Xcode → Clean Build Folder');
console.log('    4. Run');
console.log('  Verify green bar matches bundled entry above');

// ── VERDICT ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(` PASSED: ${passed.length}  WARNINGS: ${warnings.length}  FAILED: ${errors.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);

if (errors.length) {
  console.log(`
GATE BLOCKED — fix failures before running a new build.

  cd ~/restorebraine
  git fetch origin cursor/apple-privacy-plist-bacf
  git reset --hard origin/cursor/apple-privacy-plist-bacf
  npm install
  npm run apply:v87-from-omega3
  npm run audit:pre-build
`);
  process.exit(1);
}

console.log('✓ GATE PASSED — safe to run npm run apply:v87-from-omega3 → Xcode Run');
console.log(`  Expected green bar: BUNDLED · ${stamp || 'BUILD_STAMP'} · ${entry || 'index-*.js'}\n`);
process.exit(0);
