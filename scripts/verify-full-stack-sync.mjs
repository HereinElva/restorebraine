#!/usr/bin/env node
/**
 * End-to-end harmonization audit: GitHub, Base44 live, Capacitor shell, iOS bundle.
 * Run on Mac after mac-build.sh --hosted and before/after Xcode Run.
 *
 * Usage:
 *   node scripts/verify-full-stack-sync.mjs
 *   node scripts/verify-full-stack-sync.mjs --strict-xcode   # also require App.app on Mac
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const strictXcode = process.argv.includes('--strict-xcode');
const CANONICAL_BRANCH = 'cursor/fix-folder-persistence-bacf';
const LIVE_URL = 'https://restorebraine.base44.app';

let blockers = [];
let warnings = [];

function read(rel) {
  const p = resolve(repo, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function run(label, cmd, { optional = false } = {}) {
  process.stdout.write(`\n--- ${label} ---\n`);
  const r = spawnSync(cmd, { shell: true, cwd: repo, encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    if (optional) {
      warnings.push(`${label} (optional)`);
      console.log(`WARN: ${label} — optional step skipped or failed`);
      return false;
    }
    blockers.push(label);
    console.log(`FAIL: ${label}`);
    return false;
  }
  console.log(`OK: ${label}`);
  return true;
}

function check(label, ok, detail = '') {
  const line = detail ? `${label} — ${detail}` : label;
  if (ok) console.log(`OK: ${line}`);
  else {
    console.log(`FAIL: ${line}`);
    blockers.push(label);
  }
  return ok;
}

console.log('══════════════════════════════════════════════════════════════');
console.log('  FULL STACK SYNC — GitHub · Base44 · Capacitor · iOS shell');
console.log('══════════════════════════════════════════════════════════════');

// ── GitHub ──────────────────────────────────────────────────────────────────
const branch = execSync('git branch --show-current', { cwd: repo, encoding: 'utf8' }).trim();
const commit = execSync('git rev-parse --short HEAD', { cwd: repo, encoding: 'utf8' }).trim();
const deploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const build = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

console.log('\n1) GITHUB');
check('canonical branch', branch === CANONICAL_BRANCH, branch);
check('BUILD_NUMBER = DEPLOY_BUILD', build === deploy, `v${build}`);
console.log(`   commit: ${commit}`);

// ── Version stamps across layers ────────────────────────────────────────────
console.log('\n2) VERSION STAMPS (all layers must agree on v' + deploy + ')');
const indexMeta = read('index.html').match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
  ?? read('index.html').match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1];
const pbxVersions = [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => m[1]);
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();

check('index.html deploy meta', indexMeta === deploy, `v${indexMeta ?? '?'}`);
check('Xcode CURRENT_PROJECT_VERSION', pbxVersions.every((v) => v === deploy), pbxVersions.join(', ') || 'missing');
check('BUILD_STAMP.txt present', !!stamp, stamp || 'missing — run mac-build.sh');

// ── Capacitor config ────────────────────────────────────────────────────────
console.log('\n3) CAPACITOR SHELL (native wrapper)');
const capRoot = read('capacitor.config.json');
const capIos = read('ios/App/App/capacitor.config.json');
const urlRoot = capRoot.match(/"url":\s*"([^"]+)"/)?.[1];
const urlIos = capIos.match(/"url":\s*"([^"]+)"/)?.[1];
const hosted = urlIos?.includes('restorebraine.base44.app');

check('hosted server.url', !!hosted, urlIos ?? 'missing');
check('root/ios configs match url', urlRoot === urlIos, urlRoot);
check('no stripe.com in allowNavigation', !/stripe\.com/.test(capRoot + capIos));
check('no BUNDLED_MODE.txt', !existsSync(resolve(repo, 'ios/App/App/BUNDLED_MODE.txt')));

// ── ios/public shell bundle ─────────────────────────────────────────────────
console.log('\n4) IOS/PUBLIC (Capacitor shell copy — fallback only in hosted mode)');
const pubIndex = resolve(repo, 'ios/App/App/public/index.html');
if (!existsSync(pubIndex)) {
  check('ios/public built', false, 'run mac-build.sh --hosted');
} else {
  const pubHtml = read('ios/App/App/public/index.html');
  const pubDeploy = pubHtml.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
    ?? pubHtml.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1];
  const pubEntry = pubHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
  check('ios/public deploy matches git', pubDeploy === deploy, `v${pubDeploy} · ${pubEntry ?? '?'}`);
  check('ios/public entry file exists', pubEntry && existsSync(resolve(repo, 'ios/App/App/public/assets', pubEntry)));
  if (hosted && pubEntry) {
    console.log(`   NOTE: hosted mode — runtime UI loads Base44 live, not ${pubEntry}`);
  }
}

// ── dist (local compile proof) ──────────────────────────────────────────────
console.log('\n5) DIST (local Vite build)');
const distIndex = resolve(repo, 'dist/index.html');
if (!existsSync(distIndex)) {
  warnings.push('dist/ not built');
  console.log('WARN: dist/ missing — run npm run build:web (optional if mac-build already ran)');
} else {
  const distEntry = read('dist/index.html').match(/assets\/(index-[^"]+\.js)/)?.[1];
  check('dist entry exists', distEntry && existsSync(resolve(repo, 'dist/assets', distEntry)), distEntry);
}

// ── Base44 live ─────────────────────────────────────────────────────────────
console.log('\n6) BASE44 LIVE (hosted apps load this at runtime)');
let liveDeploy = '?';
let liveEntry = '?';
try {
  const liveHtml = execSync(`curl -sL --max-time 15 '${LIVE_URL}/'`, { encoding: 'utf8' });
  liveDeploy = liveHtml.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
    ?? liveHtml.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1]
    ?? '?';
  liveEntry = liveHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
  const liveBody = execSync(`curl -sL --max-time 20 '${LIVE_URL}/assets/${liveEntry}'`, { encoding: 'utf8' });
  check('live deploy matches git', liveDeploy === deploy, `v${liveDeploy}`);
  check('live bundle not stale ghost', !liveEntry.includes('mlcqt5ef'), liveEntry);
  check('live has claimOrphanedData', liveBody.includes('claimOrphanedData'));
  check('live has payment modal', liveBody.includes('data-rb-payment-modal'));
  check('live has stripe in-app', liveBody.includes('openInWebView'));
  if (hosted && existsSync(pubIndex)) {
    const pubEntry = read('ios/App/App/public/index.html').match(/assets\/(index-[^"]+\.js)/)?.[1];
    if (pubEntry && liveEntry && pubEntry !== liveEntry) {
      console.log(`   OK: ios/public (${pubEntry}) != live (${liveEntry}) — expected in hosted mode`);
    }
  }
} catch (e) {
  check('Base44 reachable', false, String(e.message || e));
}

// ── Backend functions in repo ─────────────────────────────────────────────
console.log('\n7) BASE44 BACKEND FUNCTIONS (must be deployed in Base44 dashboard)');
for (const fn of ['claimOrphanedData', 'createCheckout', 'verifyPayment', 'verifyApplePurchase']) {
  check(`repo has ${fn}`, existsSync(resolve(repo, `base44/functions/${fn}/entry.ts`)));
}

// ── Automated sub-audits ────────────────────────────────────────────────────
run('verify-build-sync.mjs', 'node scripts/verify-build-sync.mjs');
run('verify-auth-flow.mjs', 'node scripts/verify-auth-flow.mjs');
run('verify-omega-baseline.mjs', 'node scripts/verify-omega-baseline.mjs');
run('verify-restorebraine-1.0.1.mjs', 'node scripts/verify-restorebraine-1.0.1.mjs');
if (existsSync(pubIndex)) {
  run('verify-ios-bundle-version.mjs', 'node scripts/verify-ios-bundle-version.mjs');
}

// ── Mac / Xcode (optional) ──────────────────────────────────────────────────
console.log('\n8) XCODE / DEVICE (Mac only — run after Product → Run)');
if (process.platform !== 'darwin') {
  console.log('   SKIP: not macOS');
} else {
  const xcodeCheck = spawnSync('bash', ['scripts/verify-xcode-app-bundle.sh'], { cwd: repo, encoding: 'utf8' });
  if (xcodeCheck.stdout) process.stdout.write(xcodeCheck.stdout);
  if (xcodeCheck.stderr) process.stderr.write(xcodeCheck.stderr);
  if (xcodeCheck.status !== 0) {
    if (strictXcode) blockers.push('verify-xcode-app-bundle.sh');
    else warnings.push('Xcode App.app not verified — Run to iPhone first');
  }

  const hostedCheck = spawnSync('bash', ['scripts/verify-hosted-app-bundle.sh'], { cwd: repo, encoding: 'utf8' });
  if (hostedCheck.stdout) process.stdout.write(hostedCheck.stdout);
  if (hostedCheck.stderr) process.stderr.write(hostedCheck.stderr);
  if (hostedCheck.status !== 0 && strictXcode) blockers.push('verify-hosted-app-bundle.sh');
  else if (hostedCheck.status !== 0) warnings.push('verify-hosted-app-bundle.sh — Run to iPhone first');
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  HARMONIZATION MAP (hosted v' + deploy + ')');
console.log('══════════════════════════════════════════════════════════════');
console.log('');
console.log('  GitHub source     -> v' + deploy + ' on ' + CANONICAL_BRANCH);
console.log('  Base44 live       -> UI users see in hosted WebView');
console.log('  Capacitor shell   -> server.url points WebView to Base44');
console.log('  ios/public        -> fallback shell only (hash may differ from live)');
console.log('  Xcode App.app     -> must copy public/ + BUILD_STAMP on Run');
console.log('  iPhone WebView    -> loads Base44; cache clears when BUILD_STAMP changes');
console.log('');

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log('');
}

if (blockers.length) {
  console.log('BLOCKERS:');
  blockers.forEach((b) => console.log(`  - ${b}`));
  console.log('');
  console.log('Fix blockers, then: bash scripts/mac-build.sh --hosted --no-git');
  console.log('Xcode: Delete app -> Clean -> Run -> verify-xcode-app-bundle.sh');
  process.exit(1);
}

console.log('PASS — Full stack harmonized for hosted v' + deploy);
console.log('');
console.log('Next on Mac (if not done):');
console.log('  1. Delete Restorebraine from iPhone');
console.log('  2. Xcode Clean Build Folder -> Run (Cmd+R)');
console.log('  3. Build log must show: Restorebraine DEPLOY OK');
console.log('  4. bash scripts/verify-xcode-app-bundle.sh');
console.log('  5. bash scripts/verify-hosted-app-bundle.sh');
console.log('  6. Test in Safari private tab AND native app');
console.log('══════════════════════════════════════════════════════════════');
