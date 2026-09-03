/**
 * Audit all layers (GitHub, Capacitor shell, Base44, Xcode, Omega lineage)
 * using omega-7 tag as historical reference + subsequent corrections.
 *
 * Omega 7 (tag omega-7, v107): frozen bundled archive — login, organize, ghost-safe.
 * Subsequent: omega-v4-core UI, hosted App Store shell, folder persistence, Stripe in-app.
 *
 * Usage: node scripts/audit-omega7-lineage.mjs
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const OMEGA_7_TAG = 'omega-7';
const OMEGA_V4_TAG = 'omega-v4-core';
const CANONICAL_BRANCH = 'cursor/fix-folder-persistence-bacf';
const LIVE = 'https://restorebraine.base44.app';

function read(rel) {
  const p = resolve(repo, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function git(args) {
  return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8' }).trim();
}

function curl(url) {
  try {
    return execSync(`curl -sL --max-time 20 '${url}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

function ok(label, detail = '') {
  console.log(`  OK   ${label}${detail ? ` — ${detail}` : ''}`);
  return true;
}

function fail(label, detail = '') {
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

function warn(label, detail = '') {
  console.log(`  WARN ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

function skip(label, detail = '') {
  console.log(`  SKIP ${label}${detail ? ` — ${detail}` : ''}`);
}

const blockers = [];
const warnings = [];
const passes = [];

function record(kind, label, detail = '') {
  const line = detail ? `${label}: ${detail}` : label;
  if (kind === 'ok') passes.push(line);
  else if (kind === 'fail') blockers.push(line);
  else warnings.push(line);
}

let omega7Commit = '';
try {
  omega7Commit = git(`rev-parse ${OMEGA_7_TAG}^{commit}`);
} catch {
  omega7Commit = '';
}

let omegaV4Commit = '';
try {
  omegaV4Commit = git(`rev-parse ${OMEGA_V4_TAG}^{commit}`);
} catch {
  omegaV4Commit = 'ec86e42';
}

console.log('══════════════════════════════════════════════════════════════');
console.log('  OMEGA-7 REFERENCE AUDIT — all layers + subsequent corrections');
console.log('══════════════════════════════════════════════════════════════');
console.log(`  Reference: ${OMEGA_7_TAG} (${omega7Commit.slice(0, 7) || 'missing'}) bundled v107`);
console.log(`  UI baseline: ${OMEGA_V4_TAG} (${omegaV4Commit.slice(0, 7)})`);
console.log(`  Current:   ${git('branch --show-current')} @ ${git('rev-parse --short HEAD')}`);

// ── 1 GITHUB ────────────────────────────────────────────────────────────────
section('1) GITHUB');
const branch = git('branch --show-current');
const deploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const build = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

if (branch === CANONICAL_BRANCH) {
  ok('canonical branch', branch);
  record('ok', 'canonical branch', branch);
} else {
  fail('canonical branch', `got ${branch}, want ${CANONICAL_BRANCH}`);
  record('fail', 'canonical branch', branch);
}

if (build === deploy) {
  ok('BUILD_NUMBER = DEPLOY_BUILD', `v${build}`);
  record('ok', 'version sync', `v${build}`);
} else {
  fail('BUILD_NUMBER ≠ DEPLOY_BUILD', `build v${build} deploy v${deploy}`);
  record('fail', 'version sync', `${build}/${deploy}`);
}

if (Number(build) >= 107) {
  ok('build ahead of Omega 7', `v${build} > v107`);
} else {
  fail('build behind Omega 7', `v${build}`);
  record('fail', 'build vs omega-7', build);
}

// ── 2 OMEGA-7 MARKERS (preserved through subsequent corrections) ───────────
section('2) OMEGA-7 MARKERS (must survive in current code)');
const omega7Markers = [
  ['src/screens/SignInScreen.jsx', 'SignInScreen', 'login screen present'],
  ['src/lib/folder-membership.js', 'loadFolderMembershipCacheSync,', 'folder cache sync'],
  [
    'src/lib/folder-membership.js',
    'return deduped.filter((folder) => folder.photo_ids.length > 0)',
    'empty folder filter',
  ],
  ['src/Layout.jsx', 'pageContent', 'layout shell (no AnimatePresence white screen)'],
];

for (const [file, needle, label] of omega7Markers) {
  const text = read(file);
  if (text.includes(needle)) {
    ok(label, file);
    record('ok', `omega-7 marker: ${label}`);
  } else {
    fail(label, `${file} missing ${needle}`);
    record('fail', `omega-7 marker: ${label}`, file);
  }
}

const layout = read('src/Layout.jsx');
if (layout.includes('AnimatePresence')) {
  fail('Layout AnimatePresence regression', 'white-screen risk from Omega 7 verify');
  record('fail', 'Layout AnimatePresence');
} else {
  ok('no Layout AnimatePresence white-screen regression');
  record('ok', 'no AnimatePresence regression');
}

// ── 3 SUBSEQUENT CORRECTIONS (post Omega-7) ─────────────────────────────────
section('3) SUBSEQUENT CORRECTIONS (post Omega-7 → v295)');
const corrections = [
  ['src/lib/folder-server-sync.js', 'claimOrphanedData', 'folder persistence server sync'],
  ['public/native-ui-scrub.js', 'openInWebView', 'Stripe in-app scrub'],
  ['public/hosted-runtime-guard.js', 'rbHostedRuntimeGuard', 'hosted cache-bust overlay'],
  ['ios/App/App/AppDelegate.swift', 'pendingCacheReload', 'WKWebView cache reload fix'],
  ['src/components/NativeLoginCard.jsx', 'data-rb-provider', 'multi-provider login (replaces Omega-7 login UI)'],
  ['src/pages/Account.jsx', 'data-rb-gallery-nav', 'Back to Gallery (omega-v4-core)'],
  ['scripts/mac-recover-hosted.sh', 'mac-recover-hosted', 'hosted recovery script'],
];

for (const [file, needle, label] of corrections) {
  const text = read(file);
  if (text.includes(needle)) {
    ok(label);
    record('ok', `correction: ${label}`);
  } else {
    fail(label, `${file}`);
    record('fail', `correction: ${label}`, file);
  }
}

// omega-v4-core protected file unchanged
const fasDiff = omegaV4Commit ? git(`diff ${omegaV4Commit} -- src/components/gallery/folderActionStyles.js`) : '';
if (!fasDiff) {
  ok('omega-v4-core folderActionStyles.js unchanged');
  record('ok', 'omega-v4-core folderActionStyles');
} else {
  fail('folderActionStyles.js drifted from omega-v4-core');
  record('fail', 'omega-v4-core folderActionStyles drift');
}

// ── 4 CAPACITOR SHELL ───────────────────────────────────────────────────────
section('4) CAPACITOR SHELL');
const capIos = read('ios/App/App/capacitor.config.json');
const hosted = capIos.includes('restorebraine.base44.app');
const bundledFlag = existsSync(resolve(repo, 'ios/App/App/BUNDLED_MODE.txt'));

if (hosted && !bundledFlag) {
  ok('hosted mode (App Store correction vs Omega-7 bundled)', capIos.match(/"url":\s*"([^"]+)"/)?.[1]);
  record('ok', 'hosted shell');
} else if (bundledFlag && !hosted) {
  warn('bundled mode active', 'Omega-7 style — Base44 Publish ignored on device');
  record('warn', 'bundled mode', 'expected hosted for App Store');
} else {
  fail('mode conflict', `hosted=${hosted} BUNDLED_MODE=${bundledFlag}`);
  record('fail', 'capacitor mode conflict');
}

if (/rb_native=v\d+/.test(capIos)) {
  ok('server.url cache-bust param');
  record('ok', 'rb_native cache bust');
} else if (hosted) {
  fail('missing rb_native on server.url');
  record('fail', 'rb_native missing');
}

if (/stripe\.com/.test(capIos)) {
  fail('stripe.com in allowNavigation');
  record('fail', 'stripe.com in allowNavigation');
} else {
  ok('no stripe.com in allowNavigation');
  record('ok', 'allowNavigation clean');
}

const pubIndex = read('ios/App/App/public/index.html');
const pubEntry = pubIndex.match(/assets\/(index-[^"]+\.js)/)?.[1];
if (pubEntry) {
  ok('ios/public shell bundle', `${pubEntry} v${pubIndex.match(/v(\d+)/)?.[1] ?? '?'}`);
} else {
  fail('ios/public missing', 'run mac-build.sh --hosted');
  record('fail', 'ios/public missing');
}

// Omega-7 expected bundled entry — intentionally different in hosted
if (pubEntry && pubEntry !== 'index-tYDTTZJZ.js') {
  ok('entry differs from Omega-7 pinned (expected)', `omega-7=index-tYDTTZJZ.js current=${pubEntry}`);
}

// ── 5 BASE44 LIVE ───────────────────────────────────────────────────────────
section('5) BASE44 LIVE (hosted runtime UI)');
const liveHtml = curl(`${LIVE}/?t=${Date.now()}`);
const liveDeploy =
  liveHtml.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1] ?? '?';
const liveEntry = liveHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const liveBody = liveEntry !== '?' ? curl(`${LIVE}/assets/${liveEntry}`) : '';

if (liveDeploy === deploy) {
  ok('live deploy matches git', `v${liveDeploy}`);
  record('ok', 'Base44 deploy', liveDeploy);
} else {
  fail('live deploy drift', `live v${liveDeploy} git v${deploy}`);
  record('fail', 'Base44 deploy drift', `${liveDeploy}/${deploy}`);
}

const liveMarkers = [
  ['claimOrphanedData', 'folder persistence'],
  ['data-rb-payment-modal', 'payment modal'],
  ['openInWebView', 'stripe in-app'],
];
for (const [pat, label] of liveMarkers) {
  if (liveBody.includes(pat)) ok(`live bundle: ${label}`);
  else {
    fail(`live bundle missing ${label}`);
    record('fail', `live ${label}`);
  }
}

const guardOnLive = /hosted-runtime-guard\.js/.test(liveHtml);
const guardJs = curl(`${LIVE}/hosted-runtime-guard.js`).includes('rbHostedRuntimeGuard');
if (guardOnLive && guardJs) {
  ok('hosted-runtime-guard on live');
} else {
  warn('hosted-runtime-guard not fully on live', `tag=${guardOnLive} js=${guardJs}`);
  record('warn', 'hosted-runtime-guard not on live');
}

const liveStripeBroken = liveHtml.includes('openInApp(u);return true');
const localStripeFixed = read('index.html').includes('return openInApp(u)');
if (localStripeFixed && liveStripeBroken) {
  warn('index.html Stripe guard fix not published to Base44');
  record('warn', 'Stripe inline guard not on live');
} else if (!liveStripeBroken) {
  ok('Stripe inline guard on live');
}

// ── 6 XCODE / DEVICE ────────────────────────────────────────────────────────
section('6) XCODE / DEVICE (Mac only)');
if (process.platform !== 'darwin') {
  skip('Xcode App.app verify', 'not macOS — run verify-xcode-app-bundle.sh on Mac');
  record('warn', 'Xcode not verified (CI)');
} else {
  const x = spawnSync('bash', ['scripts/verify-xcode-app-bundle.sh'], { cwd: repo, encoding: 'utf8' });
  if (x.stdout) process.stdout.write(x.stdout.split('\n').map((l) => `  ${l}`).join('\n') + '\n');
  if (x.status === 0) {
    ok('App.app bundle verified');
    record('ok', 'Xcode App.app');
  } else {
    warn('App.app not installed yet', 'Xcode Product → Run required');
    record('warn', 'Xcode Run not done');
  }
  const h = spawnSync('bash', ['scripts/verify-hosted-app-bundle.sh'], { cwd: repo, encoding: 'utf8' });
  if (h.status !== 0) {
    warn('hosted App.app check', 'needs Xcode Run');
    record('warn', 'hosted App.app check');
  }
}

// ── 7 OMEGA-7 ARCHIVE INTEGRITY (informational on current branch) ─────────────
section('7) OMEGA-7 ARCHIVE (informational — current branch is NOT frozen v107)');
if (omega7Commit) {
  ok('omega-7 tag exists', omega7Commit.slice(0, 7));
  skip('byte-exact v107 bundle', 'use git reset --hard omega-7 + npm run restore:omega-7 to restore archive');
  if (hosted) {
    ok('mode change from Omega-7', 'bundled v107 → hosted v295 (App Store correction)');
  }
} else {
  warn('omega-7 tag missing', 'git fetch origin --tags');
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('══════════════════════════════════════════════════════════════');
console.log(`  Pass: ${passes.length}  Warn: ${warnings.length}  Block: ${blockers.length}`);
console.log('');
console.log('  Omega-7 reference     → login + organize + ghost-safe bundled v107');
console.log('  omega-v4-core         → gallery/folder UI baseline (protected)');
console.log('  Subsequent corrections→ hosted shell, folder-server-sync, Stripe in-app, cache reload');
console.log('');

if (blockers.length) {
  console.log('BLOCKERS:');
  blockers.forEach((b) => console.log(`  • ${b}`));
  console.log('');
}

if (warnings.length) {
  console.log('WARNINGS:');
  warnings.forEach((w) => console.log(`  • ${w}`));
  console.log('');
}

if (!blockers.length) {
  console.log('PASS — GitHub + Capacitor shell + Omega lineage OK at v' + deploy);
  if (warnings.some((w) => w.includes('Base44') || w.includes('hosted-runtime') || w.includes('Stripe') || w.includes('Xcode'))) {
    console.log('');
    console.log('Remaining (non-repo): Base44 Publish unpublished files + Xcode Run on Mac');
    console.log('  bash scripts/base44-publish-wizard.sh → Publish');
    console.log('  bash scripts/mac-recover-hosted.sh → Xcode Clean → Run');
  }
  process.exit(warnings.length ? 0 : 0);
}

console.log('Fix blockers, then re-run: node scripts/audit-omega7-lineage.mjs');
process.exit(1);
