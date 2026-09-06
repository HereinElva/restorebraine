/**
 * Cross-layer discrepancy map — why GitHub / Base44 / Capacitor / Xcode
 * can all "pass" individually but the iPhone still shows no change.
 *
 * Usage: node scripts/audit-layer-discrepancies.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  parseDeployFromHtml,
  parseSourceCommitFromHtml,
} from './lib/parse-deploy-meta.mjs';

const LIVE = 'https://restorebraine.base44.app';

function read(p) {
  return existsSync(p) ? readFileSync(resolve(p), 'utf8') : '';
}

function curl(path) {
  try {
    return execSync(`curl -sL --max-time 20 '${LIVE}${path}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function bundleFromHtml(html) {
  return html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'unknown';
}

function deployFromHtml(html) {
  return parseDeployFromHtml(html);
}

function stripePattern(html) {
  if (html.includes('return openInApp(u);}var a=Location')) return 'OK (return openInApp)';
  if (html.includes('openInApp(u);return true;}var a=Location')) return 'BROKEN (always return true)';
  return 'missing';
}

function guardStatus(body) {
  if (!body || body.trimStart().startsWith('<!DOCTYPE')) return 'missing/HTML';
  if (body.includes('rbHostedRuntimeGuard')) return `OK (${body.length} bytes)`;
  return `OLD redirect (${body.length} bytes)`;
}

const gitDeploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const gitBuild = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const gitIndex = read('index.html');
const gitGuard = read('public/hosted-runtime-guard.js');
const gitDistHtml = read('dist/index.html');
const gitIosHtml = read('ios/App/App/public/index.html');
const capIos = read('ios/App/App/capacitor.config.json');
const serverUrl = capIos.match(/"url"\s*:\s*"([^"]+)"/)?.[1] ?? 'missing';
const buildStamp = read('ios/App/App/BUILD_STAMP.txt').trim().replace(/\s+/g, ' ');

const liveHtml = curl('/?t=' + Date.now());
const liveGuard = curl('/hosted-runtime-guard.js');
const liveBundleName = bundleFromHtml(liveHtml);
const liveBundle = liveBundleName !== 'unknown' ? curl(`/assets/${liveBundleName}`) : '';

const layers = [
  {
    name: 'GitHub source',
    role: 'Dev truth — NOT auto-deployed anywhere',
    deploy: `v${gitDeploy}`,
    bundle: gitDistHtml ? bundleFromHtml(gitDistHtml) : '(no dist/)',
    stripe: stripePattern(gitIndex),
    guard: guardStatus(gitGuard),
    communicates: '→ Base44 only via manual paste + Publish',
  },
  {
    name: 'Base44 live CDN',
    role: 'What hosted iPhone WebView actually runs',
    deploy: `v${deployFromHtml(liveHtml)}`,
    bundle: liveBundleName,
    stripe: stripePattern(liveHtml),
    guard: guardStatus(liveGuard),
    communicates: '← GitHub (manual). → iPhone via server.url',
  },
  {
    name: 'dist/ (local Vite)',
    role: 'Mac build output — not uploaded to Base44 automatically',
    deploy: gitDistHtml ? `v${deployFromHtml(gitDistHtml)}` : '?',
    bundle: gitDistHtml ? bundleFromHtml(gitDistHtml) : 'missing',
    stripe: stripePattern(gitDistHtml || gitIndex),
    guard: 'N/A (in public/ only)',
    communicates: '→ ios/public via cap sync. ≠ Base44 live',
  },
  {
    name: 'ios/public (Capacitor copy)',
    role: 'Shell fallback ONLY in hosted mode',
    deploy: gitIosHtml ? `v${deployFromHtml(gitIosHtml)}` : '?',
    bundle: gitIosHtml ? bundleFromHtml(gitIosHtml) : 'missing',
    stripe: stripePattern(gitIosHtml || gitIndex),
    guard: 'N/A',
    communicates: '→ App.app on Xcode Run. Ignored if server.url set',
  },
  {
    name: 'Capacitor server.url',
    role: 'Tells WebView where to load UI',
    deploy: serverUrl.includes(`v${gitDeploy}`) ? `v${gitDeploy} in URL` : 'mismatch',
    bundle: 'loads Base44 live bundle',
    stripe: serverUrl.includes('restorebraine.base44.app') ? 'hosted' : 'bundled/wrong',
    guard: 'N/A',
    communicates: `→ ${serverUrl}`,
  },
  {
    name: 'BUILD_STAMP.txt',
    role: 'Triggers WKWebView cache wipe on native reinstall',
    deploy: buildStamp || 'missing',
    bundle: 'N/A',
    stripe: 'N/A',
    guard: 'N/A',
    communicates: '→ AppDelegate on Xcode Run',
  },
];

console.log('══════════════════════════════════════════════════════════════');
console.log('  LAYER DISCREPANCY MAP — Restorebraine hosted v' + gitDeploy);
console.log('══════════════════════════════════════════════════════════════\n');

console.log('ARCHITECTURE (hosted mode):\n');
console.log('  GitHub ──manual paste──► Base44 Publish ──CDN──► iPhone WebView');
console.log('                              ▲');
console.log('  Xcode/Capacitor shell ──────┘ server.url points here');
console.log('  ios/public bundle is IGNORED at runtime (fallback only)\n');

console.log('LAYER TABLE:\n');
for (const L of layers) {
  console.log(`  ${L.name}`);
  console.log(`    Role:     ${L.role}`);
  console.log(`    Deploy:   ${L.deploy}`);
  console.log(`    Bundle:   ${L.bundle}`);
  console.log(`    Stripe:   ${L.stripe}`);
  console.log(`    Guard:    ${L.guard}`);
  console.log(`    Link:     ${L.communicates}`);
  console.log('');
}

const blockers = [];

if (gitDeploy !== deployFromHtml(liveHtml)) {
  blockers.push(`Deploy stamp: git v${gitDeploy} ≠ live v${deployFromHtml(liveHtml)}`);
}
if (stripePattern(gitIndex).startsWith('OK') && stripePattern(liveHtml).startsWith('BROKEN')) {
  blockers.push('index.html Stripe guard: git fixed, live still broken — Publish not applied');
}
if (gitGuard.includes('rbHostedRuntimeGuard') && !liveGuard.includes('rbHostedRuntimeGuard')) {
  blockers.push('hosted-runtime-guard.js: git has overlay, live has old redirect — Publish not applied');
}
if (gitDistHtml && bundleFromHtml(gitDistHtml) !== liveBundleName) {
  blockers.push(
    `Bundle hash differs git dist (${bundleFromHtml(gitDistHtml)}) vs live (${liveBundleName}) — EXPECTED until Base44 Publish rebuilds`,
  );
}
if (gitIosHtml && bundleFromHtml(gitIosHtml) !== liveBundleName) {
  blockers.push(
    `ios/public (${bundleFromHtml(gitIosHtml)}) ≠ live (${liveBundleName}) — EXPECTED in hosted mode (not a bug)`,
  );
}
if (!liveBundle.includes('Runtime diagnostic') && existsSync('src/components/RuntimeDiagnostic.jsx')) {
  blockers.push('RuntimeDiagnostic in git but not in live bundle — Account.jsx publish needs Publish rebuild');
}
if (gitBuild !== gitDeploy) {
  blockers.push(`Git internal drift: BUILD_NUMBER v${gitBuild} ≠ DEPLOY_BUILD v${gitDeploy}`);
}
if (!serverUrl.includes('restorebraine.base44.app')) {
  blockers.push(`Capacitor not hosted: server.url=${serverUrl}`);
}

console.log('DISCREPANCY VERDICT:\n');

const realBlockers = blockers.filter(
  (b) => !b.includes('EXPECTED in hosted mode') && !b.includes('EXPECTED until'),
);
const expected = blockers.filter((b) => b.includes('EXPECTED'));

if (realBlockers.length) {
  console.log('  BLOCKERS (fix these — cause "no change"):\n');
  realBlockers.forEach((b, i) => console.log(`    ${i + 1}. ${b}`));
  console.log('');
} else {
  console.log('  No git↔live content blockers detected.\n');
}

if (expected.length) {
  console.log('  EXPECTED differences (NOT bugs):\n');
  expected.forEach((b) => console.log(`    • ${b}`));
  console.log('');
}

console.log('WHY EACH LAYER CAN PASS ALONE BUT PHONE UNCHANGED:\n');
console.log('  • GitHub push     → does NOT update Base44 live (separate systems)');
console.log('  • Base44 Save     → does NOT update CDN until Publish completes');
console.log('  • mac-complete-rebuild → updates shell only, not Base44 UI');
console.log('  • Xcode verify    → checks App.app on Mac, not live Base44 content');
console.log('  • audit section 3 → bundle markers can pass while section 8 fails');
console.log('');

console.log('FIX ORDER:\n');
console.log('  1. Base44: click Publish (wait for build) → audit section 8 must PASS');
console.log('  2. Safari private tab: must match audit before testing native');
console.log('  3. Delete app → Xcode Run → verify-xcode-app-bundle.sh');
console.log('  4. Account → Runtime diagnostic: origin = restorebraine.base44.app');
console.log('');
console.log('Run: node scripts/audit-capacitor-sync-scenarios.mjs');
console.log('Run: node scripts/audit-base44-bundle.mjs');
console.log('══════════════════════════════════════════════════════════════\n');

process.exit(realBlockers.length ? 1 : 0);
