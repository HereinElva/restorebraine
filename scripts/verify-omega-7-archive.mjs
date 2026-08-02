#!/usr/bin/env node
/**
 * Verify Omega 7 archive integrity — bundled mode, ghost allow, frozen build pin.
 * Run after restore:omega-7 or before Xcode Archive.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { OMEGA_7, OMEGA_7_TAG } from './omega-7-manifest.mjs';

const errors = [];
const warnings = [];

function read(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return '';
  }
}

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
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

// ── Git pin ───────────────────────────────────────────────────────────────────
try {
  execSync(`git rev-parse --verify ${OMEGA_7_TAG}^{commit}`, { stdio: 'ignore' });
} catch {
  fail(`Git tag ${OMEGA_7_TAG} missing — run: git fetch origin --tags`);
}

const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
let tagCommit = '';
try {
  tagCommit = execSync(`git rev-parse ${OMEGA_7_TAG}^{commit}`, { encoding: 'utf8' }).trim();
} catch {}

if (tagCommit && head !== tagCommit) {
  warn(`HEAD (${head.slice(0, 7)}) is not exactly tag ${OMEGA_7_TAG} (${tagCommit.slice(0, 7)}) — restore with: npm run restore:omega-7`);
}

// ── Build info ────────────────────────────────────────────────────────────────
const buildInfo = read('src/lib/build-info.js');
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
const buildNum = buildInfo.match(/BUILD_NUMBER = (\d+)/)?.[1];
const archive = buildInfo.match(/OMEGA_ARCHIVE = '([^']+)'/)?.[1];

if (archive !== OMEGA_7.archive) fail(`OMEGA_ARCHIVE must be "${OMEGA_7.archive}" (got ${archive || 'missing'})`);
if (buildNum !== String(OMEGA_7.buildNumber)) fail(`BUILD_NUMBER must be v${OMEGA_7.buildNumber} (got v${buildNum || '?'})`);
if (!stamp.includes(OMEGA_7.archive)) fail(`BUILD_STAMP.txt must contain "${OMEGA_7.archive}"`);
if (!stamp.includes(`v${OMEGA_7.buildNumber}`)) fail(`BUILD_STAMP.txt must contain v${OMEGA_7.buildNumber}`);

// ── Bundled mode ──────────────────────────────────────────────────────────────
const iosCap = read('ios/App/App/capacitor.config.json');
if (iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app')) {
  fail('ios/App/App/capacitor.config.json has server.url — hosted mode breaks Omega 7');
}

const indexHtml = read('ios/App/App/public/index.html');
if (!indexHtml) fail('Missing ios/App/App/public/index.html — Omega 7 is a bundled archive');
if (indexHtml.includes('login-redirect.js')) {
  fail('Bundled index.html includes login-redirect.js — wrong build path (use tag bundle, not npm run build)');
}

const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
const assetsDir = resolve('ios/App/App/public/assets');
const appJs = existsSync(assetsDir)
  ? readdirSync(assetsDir).find((f) => f.startsWith('App-') && f.endsWith('.js'))
  : null;

if (!entry) fail('Bundled index.html missing entry script');
if (!appJs) fail('Bundled App-*.js missing in ios/App/App/public/assets');

if (head === tagCommit) {
  if (entry !== OMEGA_7.pinnedEntry) {
    fail(`Byte-exact Omega 7 expects entry ${OMEGA_7.pinnedEntry}, got ${entry} — do not rebuild; git reset --hard ${OMEGA_7_TAG}`);
  }
  if (appJs !== OMEGA_7.pinnedApp) {
    fail(`Byte-exact Omega 7 expects App chunk ${OMEGA_7.pinnedApp}, got ${appJs}`);
  }
} else if (entry !== OMEGA_7.pinnedEntry) {
  warn(`Bundled entry ${entry} differs from pinned ${OMEGA_7.pinnedEntry} — OK only after intentional rebuild, not for archive`);
}

// ── Ghost allow (no ghost builds in archive) ──────────────────────────────────
const ghostText = read('ios/App/App/ghost-builds.txt');
if (!ghostText.trim()) fail('ghost-builds.txt missing');

const { block, allow } = parseGhostLists(ghostText);
const bundled = [entry, appJs].filter(Boolean);
const blocked = bundled.filter((f) => block.includes(f) && !allow.includes(f));

if (blocked.length) {
  fail(`Bundled assets GHOST-BLOCKED (stale list): ${blocked.join(', ')} — run: npm run ghosts:sync`);
}

for (const f of bundled) {
  if (!allow.includes(f)) {
    fail(`Bundled asset not in ghost ALLOW list: ${f} — run: npm run ghosts:sync`);
  }
}

// Scan/discover strip bundled allow — detect regression
if (ghostText.includes('npm run ghosts:scan') && !ghostText.includes('npm run ghosts:sync')) {
  warn('ghost-builds.txt may have been written by ghosts:scan (CDN-only) — run npm run ghosts:sync');
}
const bundledInAllow = bundled.every((f) => allow.includes(f));
if (!bundledInAllow) {
  fail('Bundled entry/App not in ghost ALLOW (+) lines — ghosts:scan/discover may have stripped them');
}

// ── Login + organize regression (inline key checks) ───────────────────────────
const checks = [
  ['src/screens/SignInScreen.jsx', 'SignInScreen'],
  ['src/lib/folder-membership.js', 'loadFolderMembershipCacheSync,'],
  ['src/lib/folder-membership.js', 'return deduped.filter((folder) => folder.photo_ids.length > 0)'],
  ['src/Layout.jsx', 'pageContent'],
];
for (const [file, needle] of checks) {
  const text = read(file);
  if (!text.includes(needle)) fail(`${file} missing Omega 7 marker: ${needle}`);
}
if (read('src/Layout.jsx').includes('AnimatePresence')) {
  fail('Layout.jsx AnimatePresence — white-screen regression');
}

// ── Output ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log(' OMEGA 7 ARCHIVE VERIFY');
console.log('══════════════════════════════════════════════════════════════');
console.log(` Tag:           ${OMEGA_7_TAG}`);
console.log(` Archive:       ${OMEGA_7.archive}`);
console.log(` BUILD_STAMP:   ${stamp || '(missing)'}`);
console.log(` MODE:          ${iosCap.includes('"url"') ? 'HOSTED (wrong)' : 'BUNDLED ✓'}`);
console.log(` Entry:         ${entry || '(missing)'}`);
console.log(` App chunk:     ${appJs || '(missing)'}`);
console.log(` Ghost allow:   ${bundled.map((f) => `${f} ✓`).join(', ')}`);
console.log('');

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  console.log('');
}

if (errors.length) {
  console.log('FAILED:');
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('\nSafe restore: npm run restore:omega-7\n');
  process.exit(1);
}

console.log('✓ Omega 7 archive intact — bundled, ghost-safe, login + organize frozen');
console.log('✓ Do NOT run: fix:no-change, ghosts:scan, apply:v87-from-omega3, port:omega3-gallery');
console.log('✓ Safe restore anytime: npm run restore:omega-7\n');
process.exit(0);
