#!/usr/bin/env node
/**
 * Deep read-only diagnosis: GitHub ↔ live Base44 ↔ Capacitor communication.
 * Does NOT run npm build or mac-ios-setup — safe before any new builds.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const HOSTED = 'https://restorebraine.base44.app';
const PLATFORM = 'https://app.base44.com';
const SDK = 'https://base44.app';
const APP_ID = '68fdc5f42768c4d045fe1bac';
const V87_TIP = 'f1b2505';

const issues = [];
const ok = [];
const info = [];

function pass(msg) { ok.push(msg); }
function fail(msg) { issues.push(msg); }
function note(msg) { info.push(msg); }

function sha256(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return { text: await res.text(), headers: Object.fromEntries(res.headers.entries()) };
}

function readGit(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return null;
  }
}

function gitShort(ref = 'HEAD') {
  try {
    return execSync(`git rev-parse --short ${ref}`, { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

import { analyzeOAuthInJs } from './lib/oauth-bundle-detect.mjs';

function printMatrix() {
  console.log(`
COMMUNICATION MATRIX (who talks to whom)
────────────────────────────────────────────────────────────────
                    │  GitHub   │  Base44   │ Capacitor │
────────────────────┼───────────┼───────────┼───────────┤
GitHub → Base44     │     —     │  MANUAL   │     —     │  Paste + Publish only
GitHub → Capacitor  │     —     │     —     │  mac-ios  │  npm build + cap sync
Capacitor → Base44  │     —     │  HTTP GET │     —     │  server.url in WKWebView
Base44 → GitHub     │  NONE     │     —     │     —     │  No pull from git
────────────────────────────────────────────────────────────────

iPhone UI source: Capacitor WKWebView → GET ${HOSTED}
                  (NOT ios/App/App/public/ unless hosted load fails)

Three URLs (all intentional):
  App UI + OAuth API:  ${HOSTED}/api/apps/auth/*
  Platform login page: ${PLATFORM}/login  (NOT /api/apps/auth — returns 404)
  SDK backend API:     ${SDK}             (Base44 SDK serverUrl)
`);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' DEEP SYNC DIAGNOSIS — GitHub ↔ Base44 ↔ Capacitor');
console.log(' (read-only — no builds run)');
console.log('═══════════════════════════════════════════════════════════════\n');

printMatrix();

const head = gitShort();
const v87Tip = gitShort(V87_TIP);
const build = readGit('src/lib/build-info.js')?.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

console.log('LAYER 1 — GITHUB (Mac repo source of truth)');
console.log(`  HEAD: ${head}   v87 tip: ${v87Tip}   BUILD: v${build}`);

const guard = readGit('src/lib/native-platform-guard.js') ?? '';
const guardHash = sha256(guard);
const guardOAuthFixed = guard.includes('${DEFAULT_APP_ORIGIN}${path}');
const guardOAuthBroken = guard.includes('${BASE44_PLATFORM_URL}${path}');

if (guardOAuthFixed && !guardOAuthBroken) {
  pass(`Git native-platform-guard.js (${guardHash}) uses DEFAULT_APP_ORIGIN for OAuth`);
} else {
  fail(`Git native-platform-guard.js OAuth pattern wrong (${guardHash})`);
}

note(`Git getCanonicalOAuthUrl would produce: ${HOSTED}/api/apps/auth/login?app_id=${APP_ID}&from_url=…`);

const capRoot = existsSync('capacitor.config.json')
  ? JSON.parse(readFileSync('capacitor.config.json', 'utf8'))
  : {};
const capIos = existsSync('ios/App/App/capacitor.config.json')
  ? JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8'))
  : null;

console.log('\nLAYER 2 — CAPACITOR (native shell — what tells WKWebView where to load)');
console.log(`  server.url (root):  ${capRoot.server?.url ?? 'missing'}`);
console.log(`  server.url (ios):   ${capIos?.server?.url ?? 'missing'}`);
console.log(`  appStartPath:       ${capIos?.server?.appStartPath ?? '(none — hosted mode)'}`);

if (capIos?.server?.url === HOSTED) pass('Capacitor ios config points WKWebView at live Base44');
else fail(`Capacitor ios config url = ${capIos?.server?.url ?? 'missing'}`);

if (!capIos?.server?.appStartPath) pass('Hosted mode — phone loads LIVE Base44, not Mac bundle first');
else fail('Bundled mode (appStartPath set) — phone loads ios/public, not live Base44');

const stamp = readGit('ios/App/App/BUILD_STAMP.txt')?.trim() ?? 'missing';
console.log(`  BUILD_STAMP: ${stamp}`);

console.log('\n  Capacitor load sequence on iPhone:');
console.log('    1. Native app starts → reads ios/App/App/capacitor.config.json');
console.log(`    2. WKWebView navigates to ${HOSTED}`);
console.log('    3. Base44 returns index.html + /assets/index-*.js (THIS is what Sign In runs)');
console.log('    4. ios/App/App/public/ used ONLY if step 2 fails (offline fallback)');

let macBundle = null;
const pubIndex = readGit('ios/App/App/public/index.html');
if (pubIndex) {
  const mainJs = pubIndex.match(/assets\/(index-[^"]+\.js)/)?.[1];
  if (mainJs && existsSync(`ios/App/App/public/assets/${mainJs}`)) {
    const js = readFileSync(`ios/App/App/public/assets/${mainJs}`, 'utf8');
    macBundle = analyzeOAuthInJs(js, `Mac fallback ${mainJs}`);
    console.log(`\n  Mac fallback bundle: ${mainJs} (${macBundle.bytes} bytes, sha ${sha256(js)})`);
    if (macBundle.fixedOrigin && !macBundle.brokenTemplate) {
      pass(`${macBundle.label} OAuth matches GitHub f1b2505 fix`);
    } else if (macBundle.brokenTemplate) {
      fail(`${macBundle.label} OAuth still uses app.base44.com template — stale ios/public`);
      note('Fix requires mac-ios-setup.sh (build) — skip if diagnosing only');
    } else {
      note(`${macBundle.label} OAuth pattern unclear`);
    }
  }
} else {
  note('No ios/App/App/public/index.html — Capacitor bundle not built on this machine');
}

console.log('\nLAYER 3 — LIVE BASE44 (what iPhone actually executes for UI + Sign In)');
let html;
let liveBundleName = null;
let liveBundleAnalysis = null;

try {
  const { text, headers } = await fetchText(HOSTED);
  html = text;
  const deploy = html.match(/name="restorebraine-deploy"[^>]*content="(v[0-9]+)"/)?.[1]
    ?? html.match(/content="(v[0-9]+)"[^>]*name="restorebraine-deploy"/)?.[1]
    ?? '?';
  const age = headers['age'] ?? headers['x-cache'] ?? '(no cache header)';
  console.log(`  Deploy meta: ${deploy}   cache: ${age}`);
  if (deploy === `v${build}`) pass(`Live HTML deploy meta = v${build}`);
  else fail(`Live HTML deploy meta ${deploy} != git v${build}`);

  liveBundleName = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? null;
  console.log(`  Main JS bundle: ${liveBundleName ?? '?'}`);

  const gitIndex = readGit('index.html') ?? '';
  const gitDeployMeta = gitIndex.match(/name="restorebraine-deploy"[^>]*content="(v[0-9]+)"/)?.[1]
    ?? gitIndex.match(/content="(v[0-9]+)"[^>]*name="restorebraine-deploy"/)?.[1];
  if (gitDeployMeta === deploy) pass('Live HTML deploy meta matches git index.html');
  else fail(`Live HTML meta ${deploy} vs git index.html ${gitDeployMeta ?? '?'}`);

  // Static public files — often synced even when bundle is stale
  console.log('\n  Per-file sync (GitHub vs live HTTP):');
  const staticFiles = ['native-oauth-return.js', 'login-redirect.js'];
  for (const file of staticFiles) {
    const gitBody = readGit(`public/${file}`);
    if (!gitBody) continue;
    try {
      const live = await fetchText(`${HOSTED}/${file}`);
      const gitH = sha256(gitBody);
      const liveH = sha256(live.text);
      const synced = gitH === liveH;
      console.log(`    ${file}: git ${gitH}  live ${liveH}  ${synced ? 'SYNCED' : 'OUT OF SYNC'}`);
      if (synced) pass(`${file} synced (sha ${gitH})`);
      else fail(`${file} OUT OF SYNC git ${gitH} vs live ${liveH}`);
    } catch (e) {
      fail(`Cannot fetch live ${file}: ${e.message}`);
    }
  }

  // Source-derived bundle — the gap
  console.log('\n  Source bundle sync (this is what Sign In depends on):');
  const markers = [
    { name: 'OAuth f1b2505 fix', git: guard.includes('app.base44.com/api/apps/auth/* returns 404'), live: null },
    { name: 'DEFAULT_APP_ORIGIN OAuth', git: guardOAuthFixed, live: null },
    { name: 'SignedOutLanding copy', git: /Find Your[\s\S]*Memories/.test(readGit('src/components/auth/SignedOutLanding.jsx') ?? ''), live: null },
  ];

  if (liveBundleName) {
    const liveJs = await fetchText(`${HOSTED}/assets/${liveBundleName}`);
    liveBundleAnalysis = analyzeOAuthInJs(liveJs.text, `Live ${liveBundleName}`);
    console.log(`  Live bundle size: ${liveBundleAnalysis.bytes} bytes   sha: ${sha256(liveJs.text)}`);

    markers[0].live = liveJs.text.includes('app.base44.com/api/apps/auth/* returns 404')
      || liveBundleAnalysis.fixedOrigin;
    markers[1].live = liveBundleAnalysis.fixedOrigin && !liveBundleAnalysis.brokenTemplate;

    const appChunk = liveJs.text.match(/assets\/(App-[^"]+\.js)/)?.[1];
    let appChunkText = '';
    if (appChunk) {
      try {
        appChunkText = (await fetchText(`${HOSTED}/assets/${appChunk}`)).text;
        console.log(`  App chunk: ${appChunk} (${appChunkText.length} bytes)`);
      } catch {
        note(`Could not fetch App chunk ${appChunk}`);
      }
    }
    markers[2].live = (appChunkText.includes('Find Your') && appChunkText.includes('Memories'))
      || liveJs.text.includes('Find Your');

    if (liveBundleAnalysis.brokenTemplate) {
      fail(`Live ${liveBundleName} builds OAuth as \${app.base44.com}\${path} → 404`);
      fail('GitHub f1b2505 fix is NOT in live bundle — Base44 Publish required');
      note(`Broken pattern found: return\`\${dt}\${e}?\${n... (minified BASE44_PLATFORM_URL + path)`);
    } else if (liveBundleAnalysis.fixedOrigin) {
      pass(`Live ${liveBundleName} OAuth uses restorebraine.base44.app`);
    } else {
      fail('Live bundle OAuth pattern unclear');
    }

    if (macBundle && liveBundleName !== pubIndex?.match(/assets\/(index-[^"]+\.js)/)?.[1]) {
      note(`Mac fallback bundle ≠ live bundle (expected in hosted mode)`);
    }

    // Estimate which git commit live bundle matches
    if (liveBundleAnalysis.brokenTemplate && !liveBundleAnalysis.fixedOrigin) {
      note('Live bundle behavior ≈ pre-f1b2505 (5762b16 era UI + broken OAuth)');
      note('HTML meta v87 was Published; JS bundle was NOT rebuilt from f1b2505 sources');
    }
  }

  console.log('\n  Marker checklist (git source vs live bundle):');
  for (const m of markers) {
    const gitOk = m.git ? '✓' : '✗';
    const liveOk = m.live ? '✓' : '✗';
    const status = m.git === m.live ? 'MATCH' : 'MISMATCH';
    console.log(`    ${m.name.padEnd(28)} git ${gitOk}   live ${liveOk}   ${status}`);
    if (m.git && !m.live) fail(`Live bundle missing: ${m.name}`);
  }
} catch (e) {
  fail(`Cannot reach live Base44: ${e.message}`);
}

console.log('\nLAYER 4 — OAUTH ENDPOINT PROBE (which host actually answers auth API)');
try {
  const good = await fetch(`${HOSTED}/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD' });
  const bad = await fetch(`${PLATFORM}/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD' });
  console.log(`  ${HOSTED}/api/apps/auth/login → HTTP ${good.status}`);
  console.log(`  ${PLATFORM}/api/apps/auth/login → HTTP ${bad.status}`);
  if (good.ok) pass('Correct OAuth host responds 200');
  else fail(`Correct OAuth host HTTP ${good.status}`);
  if (bad.status === 404) pass('Wrong host app.base44.com/api/apps/auth → 404 (proves live JS must not use it)');
  else fail(`Expected 404 on platform auth API, got ${bad.status}`);
} catch (e) {
  note(`OAuth probe skipped: ${e.message}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' VERDICT');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of issues) console.log(`  ✗ ${m}`);

const capTalksBase44 = ok.some((m) => m.includes('Capacitor ios config points'));
const gitTalksCap = ok.some((m) => m.includes('Hosted mode'));
const gitTalksBase44 = ok.some((m) => m.includes('native-platform-guard.js') && m.includes('DEFAULT_APP_ORIGIN'))
  && issues.some((m) => m.includes('NOT in live bundle') || m.includes('Base44 Publish'));

console.log(`
LINK STATUS:
  Capacitor → Base44:  ${capTalksBase44 ? '✓ CONNECTED' : '?'}  (server.url HTTP load works)
  GitHub → Capacitor:  ${gitTalksCap ? '✓ CONFIG OK' : '?'}     (mac-ios-setup syncs shell; optional build)
  GitHub → Base44:     ${gitTalksBase44 ? '✗ NOT SYNCED' : issues.length ? '✗ GAPS' : '✓'}     (no git push → live JS)

WHY "NO CHANGE" ON PHONE (without new Xcode build):
  • Capacitor already loads live Base44 — rebuilding Xcode does NOT change live JS
  • Live bundle ${liveBundleName ?? '?'} is stale (pre-f1b2505 OAuth)
  • HTML says v${build} but JS bundle hash unchanged since last Base44 Publish of HTML only
  • Static files (native-oauth-return.js) may match git while main bundle does not

FIX THAT ACTUALLY CHANGES SIGN IN (no Mac build required):
  Base44 browser editor → paste src/lib/native-platform-guard.js → Publish
  Re-run: npm run diagnose:sync

Mac build only needed for: ios/App/App/public fallback + BUILD_STAMP (offline edge case)
`);

console.log('═══════════════════════════════════════════════════════════════');
if (issues.length) process.exit(1);
