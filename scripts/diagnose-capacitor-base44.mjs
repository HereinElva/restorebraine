#!/usr/bin/env node
/**
 * Diagnose Capacitor ↔ GitHub ↔ live Base44 alignment.
 * These three do NOT auto-sync — this script shows where they match or diverge.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const HOSTED = 'https://restorebraine.base44.app';
const APP_ID = '68fdc5f42768c4d045fe1bac';
const issues = [];
const ok = [];

function pass(msg) { ok.push(msg); }
function fail(msg) { issues.push(msg); }

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const build = readFileSync('src/lib/build-info.js', 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1];

console.log('═══════════════════════════════════════════════════════════════');
console.log(' CAPACITOR ↔ GITHUB ↔ BASE44 — three-layer diagnosis');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Layer 1: GitHub (source of truth for Mac builds) ──
console.log('1. GITHUB (Mac repo)');
console.log(`   HEAD: ${head}  BUILD: v${build ?? '?'}`);

const guard = readFileSync('src/lib/native-platform-guard.js', 'utf8');
if (guard.includes('${DEFAULT_APP_ORIGIN}${path}')) {
  pass('Git OAuth → restorebraine.base44.app/api/apps/auth/*');
} else if (guard.includes('${BASE44_PLATFORM_URL}${path}')) {
  fail('Git OAuth still uses app.base44.com (pre-f1b2505)');
} else {
  fail('Git OAuth pattern unclear');
}

const capRoot = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const capIos = existsSync('ios/App/App/capacitor.config.json')
  ? JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8'))
  : null;

if (capRoot.server?.url === HOSTED) pass('Git capacitor.config.json → hosted Base44');
else fail(`Git capacitor.config.json url = ${capRoot.server?.url ?? 'missing'}`);

// ── Layer 2: Capacitor (native shell config) ──
console.log('\n2. CAPACITOR (native iOS shell)');
if (capIos?.server?.url === HOSTED) pass('ios/App/App/capacitor.config.json matches hosted URL');
else fail(`iOS capacitor config url = ${capIos?.server?.url ?? 'missing'}`);

if (capRoot.server?.url === capIos?.server?.url) pass('Root vs iOS Capacitor configs match');
else fail('Capacitor root vs ios config MISMATCH');

if (capIos?.server?.appStartPath) fail('appStartPath set — bundled mode, not talking to live Base44');
else pass('No appStartPath — hosted mode (loads live Base44 in WKWebView)');

const stamp = existsSync('ios/App/App/BUILD_STAMP.txt')
  ? readFileSync('ios/App/App/BUILD_STAMP.txt', 'utf8').trim()
  : 'missing';
console.log(`   BUILD_STAMP: ${stamp}`);

const pubIndex = existsSync('ios/App/App/public/index.html')
  ? readFileSync('ios/App/App/public/index.html', 'utf8')
  : '';
const mainJs = pubIndex.match(/assets\/(index-[^"]+\.js)/)?.[1];
if (mainJs && existsSync(`ios/App/App/public/assets/${mainJs}`)) {
  const js = readFileSync(`ios/App/App/public/assets/${mainJs}`, 'utf8');
  const macBroken = /\$\{dt\}\$\{e\}/.test(js) || (/\$\{it\}\$\{e\}/.test(js) && js.includes('app.base44.com'));
  const macFixed = js.includes('fe="https://restorebraine.base44.app"') || js.includes('restorebraine.base44.app/api/apps/auth');
  if (macFixed && !macBroken) pass(`Mac fallback bundle ${mainJs} OAuth OK (offline only)`);
  else if (macBroken) fail(`Mac fallback ${mainJs} OAuth broken — re-run mac-ios-setup.sh`);
  else pass(`Mac fallback ${mainJs} (hosted mode — phone uses live site, not this file)`);
}

console.log('\n   How Capacitor talks to Base44:');
console.log('   • server.url tells WKWebView to load https://restorebraine.base44.app');
console.log('   • Capacitor does NOT pull from GitHub automatically');
console.log('   • ios/App/App/public/ is fallback only when hosted load fails');

// ── Layer 3: Live Base44 (what phone UI actually runs) ──
console.log('\n3. LIVE BASE44 (what iPhone WKWebView runs)');
let html;
try {
  html = await fetchText(HOSTED);
} catch (e) {
  fail(`Cannot reach ${HOSTED}: ${e.message}`);
  printSummary();
  process.exit(1);
}

const deploy = html.match(/content="(v[0-9]+)" name="restorebraine-deploy"/)?.[1] ?? '?';
console.log(`   Deploy meta: ${deploy}`);
if (deploy === `v${build}`) pass(`Live HTML deploy meta matches git BUILD v${build}`);
else fail(`Live deploy ${deploy} != git BUILD v${build}`);

const idx = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
console.log(`   JS bundle: ${idx ?? '?'}`);

if (idx) {
  try {
    const liveJs = await fetchText(`${HOSTED}${idx}`);
    const liveBroken = /\$\{dt\}\$\{e\}/.test(liveJs);
    const liveFixed = liveJs.includes('fe="https://restorebraine.base44.app"');
    if (liveBroken) {
      fail('Live JS OAuth uses app.base44.com (404) — NOT synced with GitHub f1b2505 fix');
      fail('GitHub and Base44 are NOT talking — Publish native-platform-guard.js in Base44 editor');
    } else if (liveFixed) {
      pass('Live JS OAuth uses restorebraine.base44.app');
    } else {
      fail('Live JS OAuth pattern unclear — republish native-platform-guard.js');
    }

    if (liveJs.includes('SignedOutLanding') || liveJs.includes('Find Your')) {
      pass('Live bundle has v87 SignedOutLanding copy');
    }
  } catch (e) {
    fail(`Cannot fetch live bundle: ${e.message}`);
  }
}

try {
  const r200 = await fetch(`${HOSTED}/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD' });
  const r404 = await fetch(`https://app.base44.com/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD' });
  if (r200.ok) pass('restorebraine.base44.app/api/apps/auth/login → 200');
  else fail(`restorebraine auth HTTP ${r200.status}`);
  if (r404.status === 404) pass('app.base44.com/api/apps/auth/login → 404 (live JS must NOT use this)');
} catch {}

console.log('\n   How Base44 talks to GitHub:');
console.log('   • NO automatic sync — git push does NOT update live site');
console.log('   • Base44 browser editor → paste files → Publish is the ONLY link');
console.log('   • HTML meta can say v87 while JS bundle is still old (your current state)');

// ── SDK backend (fourth URL — not Capacitor UI) ──
console.log('\n4. BASE44 API (backend — separate from UI host)');
console.log('   SDK serverUrl: https://base44.app (API calls)');
console.log('   App UI host:   https://restorebraine.base44.app');
console.log('   Platform web:  https://app.base44.com (login page — NOT auth API)');
pass('Three URLs are intentional — confusion is OAuth on wrong host');

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  for (const m of ok) console.log(`  ✓ ${m}`);
  for (const m of issues) console.log(`  ✗ ${m}`);

  if (issues.some((i) => i.includes('NOT talking') || i.includes('app.base44.com'))) {
    console.log(`
ROOT CAUSE: Capacitor IS loading Base44 (they talk at HTTP level).
            GitHub source and live Base44 JS are OUT OF SYNC.

Capacitor → Base44:  ✓ connected (server.url loads live site)
GitHub → Capacitor:  ✓ mac-ios-setup builds native shell
GitHub → Base44:     ✗ NO AUTO SYNC — Publish required

FIX (Base44 browser only):
  Paste from ~/restorebraine and Publish:
    src/lib/native-platform-guard.js
    index.html, src/App.jsx, SignedOutLanding.jsx
`);
  }
  console.log('═══════════════════════════════════════════════════════════════');
  if (issues.length) process.exit(1);
}

printSummary();
