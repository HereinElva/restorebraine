#!/usr/bin/env node
/**
 * Trace Sign In OAuth URL from each layer — read-only, no builds.
 * Shows exactly what URL each layer would open when user taps Sign In.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const HOSTED = 'https://restorebraine.base44.app';
const PLATFORM = 'https://app.base44.com';
const APP_ID = '68fdc5f42768c4d045fe1bac';

const issues = [];
const ok = [];

function pass(msg) { ok.push(msg); }
function fail(msg) { issues.push(msg); }

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function gitCanonicalUrl() {
  return `${HOSTED}/api/apps/auth/login?app_id=${APP_ID}&from_url=${encodeURIComponent(HOSTED)}&prompt=select_account`;
}

function findMacMainBundle() {
  const indexPath = resolve('ios/App/App/public/index.html');
  if (!existsSync(indexPath)) return null;
  const html = readFileSync(indexPath, 'utf8');
  const name = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
  if (!name || !existsSync(`ios/App/App/public/assets/${name}`)) return null;
  return { name, js: readFileSync(`ios/App/App/public/assets/${name}`, 'utf8') };
}

import { extractOAuthHost } from './lib/oauth-bundle-detect.mjs';
import { checkDiagnosticScriptsFreshness } from './lib/check-diagnostic-scripts.mjs';

console.log('═══════════════════════════════════════════════════════════════');
console.log(' OAUTH TRACE — what Sign In opens on each layer');
console.log(' (read-only — no builds)');
console.log('═══════════════════════════════════════════════════════════════\n');

const freshness = checkDiagnosticScriptsFreshness();
if (freshness.stale) {
  console.log('⚠ Pull latest scripts first — old versions report "unknown" for fixed live bundles.\n');
}

console.log('When user taps "Sign In" on iPhone (hosted Capacitor mode):\n');
console.log('  Step 1: WKWebView loads live Base44 JS');
console.log('  Step 2: JS calls getCanonicalOAuthUrl() → builds auth URL');
console.log('  Step 3: native-google-oauth opens URL in SFSafariViewController');
console.log('  Step 4: Google OAuth → redirect back to from_url with access_token\n');

console.log('CORRECT URL (GitHub f1b2505 + AppDelegate native bridge):');
const correct = gitCanonicalUrl();
console.log(`  ${correct}\n`);

// Layer: Git source
const guard = readFileSync('src/lib/native-platform-guard.js', 'utf8');
const gitUsesFixed = guard.includes('${DEFAULT_APP_ORIGIN}${path}');
console.log('1. GITHUB SOURCE (native-platform-guard.js)');
console.log(`   getCanonicalOAuthUrl → ${correct}`);
if (gitUsesFixed) pass('Git source builds OAuth on restorebraine.base44.app');
else fail('Git source OAuth pattern wrong');

// Layer: AppDelegate native bridge (runs in WKWebView before/alongside JS)
const delegate = readFileSync('ios/App/App/AppDelegate.swift', 'utf8');
const delegateFixed = delegate.includes('RESTOREBRAINE + path') && !/PLATFORM \+ path/.test(delegate);
console.log('\n2. NATIVE BRIDGE (AppDelegate.swift injected JS)');
console.log('   getCanonicalOAuthUrl → RESTOREBRAINE + /api/apps/auth/login?...');
console.log(`   Resolves to: ${correct}`);
if (delegateFixed) pass('AppDelegate intercept uses RESTOREBRAINE (partial mitigation)');
else fail('AppDelegate OAuth uses wrong host');

console.log('\n   Note: AppDelegate click interceptor may override stale live JS,');
console.log('   but is unreliable if live JS handles Sign In first. Base44 Publish is definitive.');

// Layer: Mac fallback bundle
console.log('\n3. MAC FALLBACK BUNDLE (ios/App/App/public — offline only)');
const mac = findMacMainBundle();
if (mac) {
  const macOAuth = extractOAuthHost(mac.js);
  console.log(`   Bundle: ${mac.name}`);
  console.log(`   OAuth host: ${macOAuth.host} (${macOAuth.pattern})`);
  console.log(`   Would open: https://${macOAuth.host}/api/apps/auth/login?app_id=…`);
  if (macOAuth.host === 'restorebraine.base44.app') pass(`Mac fallback ${mac.name} OAuth OK`);
  else fail(`Mac fallback ${mac.name} OAuth broken (${macOAuth.host})`);
} else {
  console.log('   (no ios/public bundle on this machine)');
}

// Layer: Live Base44 — what phone actually runs
console.log('\n4. LIVE BASE44 (what iPhone WKWebView executes — PRIMARY)');
let liveBundle = null;
try {
  const html = await fetchText(HOSTED);
  const name = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1];
  if (name) {
    const js = await fetchText(`${HOSTED}/assets/${name}`);
    liveBundle = { name, js };
    const liveOAuth = extractOAuthHost(js);
    console.log(`   Bundle: ${name} (${js.length} bytes)`);
    console.log(`   OAuth host: ${liveOAuth.host} (${liveOAuth.pattern})`);
    const brokenUrl = `https://${liveOAuth.host}/api/apps/auth/login?app_id=${APP_ID}&from_url=…`;
    console.log(`   Would open: ${brokenUrl}`);

    if (liveOAuth.fixed) {
      pass(`Live ${name} OAuth uses restorebraine.base44.app (${liveOAuth.pattern})`);
    } else if (liveOAuth.broken) {
      fail(`Live ${name} OAuth uses ${liveOAuth.host} → HTTP 404`);
    } else {
      fail(`Live ${name} OAuth pattern unclear — run: git pull origin cursor/apple-privacy-plist-bacf`);
      if (js.includes('de="https://restorebraine.base44.app"') || js.includes('fe="https://restorebraine.base44.app"')) {
        console.log('   Note: bundle contains restorebraine.base44.app origin — likely fixed; update diagnostic scripts');
      }
    }

    // Show minified snippet if broken
    if (liveOAuth.pattern.includes('broken')) {
      const snippet = js.match(/return`\$\{dt\}\$\{e\}[^`]{0,60}`/)?.[0]
        ?? js.match(/return`\$\{it\}\$\{e\}[^`]{0,60}`/)?.[0];
      if (snippet) console.log(`   Minified code: ${snippet}`);
    }
  }
} catch (e) {
  fail(`Cannot fetch live Base44: ${e.message}`);
}

// Endpoint probe
console.log('\n5. ENDPOINT PROBE (which auth URL actually works)');
try {
  const good = await fetch(`${HOSTED}/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD', redirect: 'manual' });
  const bad = await fetch(`${PLATFORM}/api/apps/auth/login?app_id=${APP_ID}`, { method: 'HEAD', redirect: 'manual' });
  console.log(`   restorebraine.base44.app/api/apps/auth/login → HTTP ${good.status}`);
  console.log(`   app.base44.com/api/apps/auth/login           → HTTP ${bad.status}`);
  if (good.ok || good.status === 302) pass('Correct auth endpoint reachable');
  if (bad.status === 404) pass('Wrong auth endpoint returns 404 as expected');
} catch (e) {
  console.log(`   Probe error: ${e.message}`);
}

// Comparison table
console.log('\n───────────────────────────────────────────────────────────────');
console.log(' SIGN IN URL COMPARISON');
console.log('───────────────────────────────────────────────────────────────');
console.log(' Layer                    │ OAuth host              │ Phone uses?');
console.log('──────────────────────────┼─────────────────────────┼────────────');
console.log(' Git source               │ restorebraine.base44.app│ no (source only)');
console.log(' AppDelegate bridge       │ restorebraine.base44.app│ maybe (interceptor)');
console.log(` Mac fallback             │ ${mac ? extractOAuthHost(mac.js).host.padEnd(23) : '?'.padEnd(23)}│ only if offline`);
console.log(` Live Base44 JS           │ ${liveBundle ? extractOAuthHost(liveBundle.js).host.padEnd(23) : '?'.padEnd(23)}│ YES ← primary`);
console.log('───────────────────────────────────────────────────────────────');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' VERDICT');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of issues) console.log(`  ✗ ${m}`);

if (issues.some((i) => i.includes('Live') && i.includes('404'))) {
  console.log(`
BLOCKER: Live bundle still routes Sign In to app.base44.com (404).
FIX: Base44 editor → paste src/lib/native-platform-guard.js → Publish
VERIFY: npm run diagnose:oauth  (live host must = restorebraine.base44.app)
`);
} else if (ok.some((m) => m.includes('Live') && m.includes('restorebraine'))) {
  console.log(`
SUCCESS: Live Base44 OAuth fixed. Next on iPhone:
  Delete app → Restart iPhone → Xcode Clean → Run
  npm run diagnose:all
`);
}

console.log('═══════════════════════════════════════════════════════════════');
if (issues.length) process.exit(1);
