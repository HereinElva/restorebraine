/**
 * Full shakedown audit — Omega 7 lineage, Stripe persistent block, all layers.
 * Explains WHY fixes stopped reaching the device and what was missed before.
 *
 * Usage: node scripts/audit-full-shakedown.mjs
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const LIVE = 'https://restorebraine.base44.app';
const CANONICAL = 'cursor/fix-folder-persistence-bacf';
const OMEGA_7 = 'omega-7';
const OMEGA_V4 = 'omega-v4-core';

function read(rel) {
  const p = resolve(repo, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function curl(url) {
  try {
    return execSync(`curl -sL --max-time 20 '${url}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function git(args) {
  return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8' }).trim();
}

function runScript(label, cmd, args = []) {
  const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8', shell: false });
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(62));
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

const blockers = [];
const warnings = [];
const harmonized = [];

function block(msg) {
  blockers.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}
function ok(msg) {
  harmonized.push(msg);
}

console.log('══════════════════════════════════════════════════════════════');
console.log('  RESTOREBRAINE FULL SHAKEDOWN AUDIT');
console.log('  Omega 7 reference → all corrections → Stripe persistent block');
console.log('══════════════════════════════════════════════════════════════\n');

// ── TIMELINE: where it broke down ───────────────────────────────────────────
console.log('── BREAKDOWN TIMELINE (Omega 7 → v295) ──\n');
console.log('  omega-7 (v107, bundled)     capacitor://localhost — full app in ios/public');
console.log('                              NO Base44 runtime, NO Stripe guards');
console.log('  omega-v4-core (v80)         Gallery/folder UI baseline only');
console.log('  v273–278                    Hosted App Store shell (server.url → Base44)');
console.log('  v283–293                    Stripe in-app cascade (scrub, inline guard, allowNav fix)');
console.log('  v294–295                    Folder persistence + hosted-runtime-guard overlay');
console.log('  ARCHITECTURE FLIP           bundled → hosted = NEW sync chain:');
console.log('                              GitHub ──manual──► Base44 Publish ──CDN──► iPhone');
console.log('                              Xcode/Capacitor = shell only (NOT the UI source)');
console.log('');

console.log('── STRIPE PERSISTENT BLOCK (root cause) ──\n');
console.log('  1. allowNavigation had stripe.com (pre-v293 / wrong branch)');
console.log('     → Main WebView navigates out to Safari (native shell issue)');
console.log('     → FIXED in git: stripe.com removed from capacitor.config');
console.log('');
console.log('  2. Broken inline intercept on LIVE Base44 index.html (v288+ trap)');
console.log('     OLD: openInApp(u); return true  → always blocks nav, silent payment fail');
console.log('     FIX: return openInApp(u)         → only block if in-app open succeeded');
console.log('     Git has FIX; live CDN still has OLD — Publish never applied');
console.log('     → Native/Xcode rebuilds CANNOT fix this (hosted loads Base44 HTML)');
console.log('');
console.log('  3. Partial Publish trap (discovered late — audit section 8)');
console.log('     Deploy meta v295 updates but index.html/public/ stay stale');
console.log('     Section 3 bundle markers pass → false confidence');
console.log('');
console.log('  4. WKWebView 7-day CDN cache (structural)');
console.log('     Same BUILD_STAMP + same bundle hash = cached old JS on device');
console.log('     → Needs Publish + delete app + Xcode Run after stamp change');
console.log('');

console.log('── PAST FAILURES NOT CAUGHT EARLY ──\n');
const missed = [
  ['GitHub push ≠ Base44 live', 'Assumed git sync updates the app UI'],
  ['Save ≠ Publish in Base44', 'Editor save does not update CDN'],
  ['ios/public ≠ live bundle hash', 'Looks like desync; expected in hosted mode'],
  ['audit section 3 pass', 'Bundle OK while index.html/guard still broken'],
  ['mac-complete-rebuild', 'Fixes shell only; cannot push to Base44 CDN'],
  ['Xcode verify pass', 'Checks App.app on Mac, not live Base44 content'],
  ['mac-resync-omega / bundled builds', 'Footgun: ignores Base44 entirely'],
  ['Safari vs native', 'Safari always external Stripe; must test native app'],
];
for (const [issue, why] of missed) {
  console.log(`  • ${issue}`);
  console.log(`    ${why}`);
}
console.log('');

// ── Live fingerprints ───────────────────────────────────────────────────────
const deploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const liveHtml = curl(`${LIVE}/?t=${Date.now()}`);
const liveGuard = curl(`${LIVE}/hosted-runtime-guard.js`);
const liveBundle = liveHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const gitStripeOk = read('index.html').includes('return openInApp(u);}var a=Location');
const liveStripeBroken = liveHtml.includes('openInApp(u);return true;}var a=Location');
const liveGuardOk = liveGuard.includes('rbHostedRuntimeGuard');
const capIos = read('ios/App/App/capacitor.config.json');
const hosted = capIos.includes('restorebraine.base44.app');
const stripeNav = /stripe\.com/.test(capIos);

console.log('── LIVE vs GIT FINGERPRINTS ──\n');
console.log(`  Git deploy:        v${deploy}`);
console.log(`  Live bundle:     ${liveBundle}`);
console.log(`  Git Stripe:      ${gitStripeOk ? 'OK (return openInApp)' : 'MISSING'}`);
console.log(`  Live Stripe:     ${liveStripeBroken ? 'BROKEN (openInApp; return true)' : liveHtml.includes('return openInApp(u)') ? 'OK' : 'unknown'}`);
console.log(`  Live guard:      ${liveGuardOk ? 'OK' : `OLD (${liveGuard.length} bytes)`}`);
console.log(`  Capacitor mode:  ${hosted ? 'HOSTED' : 'BUNDLED/WRONG'}`);
console.log(`  stripe.com nav:  ${stripeNav ? 'YES (bad)' : 'no'}`);
console.log('');

if (hosted && !stripeNav) ok('Native shell: hosted, no stripe.com in allowNavigation');
else if (stripeNav) block('stripe.com still in allowNavigation — rebuild native shell');
else if (!hosted) block('Not in hosted mode — run mac-build.sh --hosted');

if (gitStripeOk && liveStripeBroken) {
  block('STRIPE PERSISTENT BLOCK: git fixed index.html but live CDN still broken — Base44 Publish required');
}
if (!liveGuardOk && read('public/hosted-runtime-guard.js').includes('rbHostedRuntimeGuard')) {
  block('hosted-runtime-guard.js not on live CDN — Base44 Publish required');
}

// ── Run sub-audits ──────────────────────────────────────────────────────────
const auditResults = [];
const scripts = [
  ['Omega 7 lineage', 'node', ['scripts/audit-omega7-lineage.mjs']],
  ['Layer discrepancies', 'node', ['scripts/audit-layer-discrepancies.mjs']],
  ['Capacitor sync scenarios', 'node', ['scripts/audit-capacitor-sync-scenarios.mjs']],
  ['Base44 bundle + ghost builds', 'node', ['scripts/audit-base44-bundle.mjs']],
  ['Full stack sync', 'node', ['scripts/verify-full-stack-sync.mjs']],
];

for (const [label, cmd, args] of scripts) {
  const code = runScript(label, cmd, args);
  auditResults.push({ label, code });
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  SHAKEDOWN VERDICT');
console.log('══════════════════════════════════════════════════════════════\n');

console.log('  Sub-audit results:');
for (const { label, code } of auditResults) {
  console.log(`    ${code === 0 ? 'PASS' : 'FAIL'}  ${label}`);
}
console.log('');

if (blockers.length) {
  console.log('  ROOT BLOCKERS:');
  blockers.forEach((b, i) => console.log(`    ${i + 1}. ${b}`));
  console.log('');
}

if (warnings.length) {
  console.log('  WARNINGS:');
  warnings.forEach((w) => console.log(`    • ${w}`));
  console.log('');
}

const nativeOk = hosted && !stripeNav && git('branch --show-current') === CANONICAL;
const base44Ok = gitStripeOk && !liveStripeBroken && liveGuardOk;

console.log('  LAYER STATUS:');
console.log(`    GitHub + native shell:  ${nativeOk ? 'HARMONIZED' : 'NEEDS mac-full-shakedown --rebuild'}`);
console.log(`    Base44 live CDN:        ${base44Ok ? 'HARMONIZED' : 'BLOCKED — Publish not applied'}`);
console.log('');

if (!base44Ok) {
  console.log('  THE PERSISTENT BLOCK IS BASE44 CDN, NOT XCODE/CAPACITOR.');
  console.log('  Rebuilding native 10× cannot change live index.html.');
  console.log('');
  console.log('  FIX (Base44 only):');
  console.log('    npm run base44:editor-check     # verify editor content');
  console.log('    bash scripts/base44-partial-publish-wizard.sh');
  console.log('    Click PUBLISH in Base44 → wait for build');
  console.log('    bash scripts/verify-base44-publish-applied.sh');
  console.log('');
}

console.log('  FULL REBUILD COMMAND (native layers):');
console.log('    bash scripts/mac-full-shakedown.sh --rebuild');
console.log('');
console.log('  After Base44 PASS + native rebuild:');
console.log('    Delete app → Xcode Clean → Run → Restorebraine DEPLOY OK');
console.log('══════════════════════════════════════════════════════════════\n');

const exitCode = blockers.length || auditResults.some((r) => r.code !== 0) ? 1 : 0;
process.exit(exitCode);
