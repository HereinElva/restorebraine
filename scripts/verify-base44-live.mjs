/**
 * Compare live Base44 deploy stamp vs local git — detects GitHub/Base44/Capacitor drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE_URL = 'https://restorebraine.base44.app';

const localDeploy =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const localBuild =
  readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

let html = '';
try {
  html = execSync(`curl -sL --max-time 15 '${LIVE_URL}'`, { encoding: 'utf8' });
} catch (error) {
  console.error('FAIL: could not fetch', LIVE_URL, error.message);
  process.exit(1);
}

const liveDeploy = html.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
  ?? html.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1]
  ?? '?';
const liveBundle = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'unknown';
const KNOWN_STALE_BUNDLES = ['index-mlcqt5ef.js', 'index-DVkubWP5.js', 'index-CGrESmC2.js'];
const hasMultiProvider = /Sign in with Apple|Continue With Apple|Continue With Microsoft|Sign In With Email/i.test(html);
const hasAppleLogo = /data-rb-apple-logo|SignInWithAppleButton/i.test(html);
const hasStripeGuard = /restorebraine-stripe-checkout/i.test(html);
const stripeInterceptOk = html.includes('return openInApp(u);}var a=Location');
const stripeInterceptBroken = html.includes('openInApp(u);return true;}var a=Location');
const hasOldSingleGoogle = !hasMultiProvider && /Continue with Google/i.test(html);

let liveGuardBody = '';
try {
  liveGuardBody = execSync(`curl -sL --max-time 15 '${LIVE_URL}/hosted-runtime-guard.js'`, { encoding: 'utf8' });
} catch {
  liveGuardBody = '';
}
const hostedGuardOk = /rbHostedRuntimeGuard/.test(liveGuardBody);

let liveBundleBody = '';
try {
  liveBundleBody = execSync(`curl -sL --max-time 20 '${LIVE_URL}/assets/${liveBundle}'`, { encoding: 'utf8' });
} catch {
  liveBundleBody = '';
}
const bundleMarkers = {
  claimOrphanedData: liveBundleBody.includes('claimOrphanedData'),
  'Folder.filter': liveBundleBody.includes('Folder.filter'),
  'data-rb-payment-modal': liveBundleBody.includes('data-rb-payment-modal'),
};

console.log('=== Base44 live vs git ===\n');
console.log(`Live site:     ${LIVE_URL}`);
console.log(`Live deploy:   v${liveDeploy}  (bundle: ${liveBundle})`);
console.log(`Git deploy:    v${localDeploy}  (build: v${localBuild})`);
console.log('');

let fail = 0;

if (liveDeploy === '?' || liveDeploy !== localDeploy) {
  console.error(`FAIL: Base44 is v${liveDeploy} but git is v${localDeploy} — OUT OF SYNC`);
  console.error('       Safari + hosted Capacitor show OLD code until you Publish.');
  fail += 1;
} else {
  console.log('OK: Base44 deploy stamp matches git');
}

if (!hasStripeGuard) {
  console.error('FAIL: Live index.html missing inline Stripe native guard');
  console.error('       Paste index.html from git (v' + localDeploy + ') → Base44 → Publish');
  fail += 1;
} else if (stripeInterceptBroken && !stripeInterceptOk) {
  console.error('FAIL: Live Stripe guard broken (openInApp; return true) — partial Publish trap');
  console.error('       bash scripts/base44-partial-publish-wizard.sh → Publish once');
  fail += 1;
} else if (stripeInterceptOk) {
  console.log('OK: Live Stripe intercept uses return openInApp(u)');
} else {
  console.log('OK: Live index.html has Stripe in-app guard');
}

if (!hostedGuardOk) {
  console.error('FAIL: Live hosted-runtime-guard.js is old (missing rbHostedRuntimeGuard)');
  console.error('       bash scripts/base44-partial-publish-wizard.sh → Publish once');
  fail += 1;
} else {
  console.log('OK: Live hosted-runtime-guard overlay present');
}

if (KNOWN_STALE_BUNDLES.includes(liveBundle)) {
  console.error(`FAIL: Live JS bundle is stale (${liveBundle}) — deploy meta updated but bundle not rebuilt`);
  console.error('       Run: node scripts/audit-base44-bundle.mjs');
  console.error('       Paste folder + payment files into Base44 → Publish once');
  fail += 1;
} else {
  console.log(`OK: Live bundle hash is not a known stale file (${liveBundle})`);
}

for (const [marker, ok] of Object.entries(bundleMarkers)) {
  if (!ok) {
    console.error(`FAIL: Live bundle missing ${marker}`);
    fail += 1;
  } else {
    console.log(`OK: Live bundle contains ${marker}`);
  }
}

if (hasOldSingleGoogle) {
  console.error('FAIL: Live site still shows OLD login (single "Continue with Google" only)');
  console.error('       Publish base44-publish-v' + localDeploy + '.txt → Base44 Code editor → Publish');
  fail += 1;
} else if (hasMultiProvider) {
  console.log('OK: Live login has multi-provider card (Google / Apple / email)');
  if (/Continue With Apple/i.test(html) && !/Sign in with Apple/i.test(html)) {
    console.error('FAIL: Live Apple button is OLD ("Continue With Apple" — no logo)');
    console.error('       Publish base44-publish-v' + localDeploy + '.txt → Base44 Code editor → Publish');
    fail += 1;
  } else if (!hasAppleLogo) {
    console.error('FAIL: Live login missing Apple logo (data-rb-apple-logo / SignInWithAppleButton)');
    console.error('       Publish base44-publish-v' + localDeploy + '.txt → Base44 Code editor → Publish');
    fail += 1;
  } else {
    console.log('OK: Live login has HIG Apple button + logo');
  }
} else {
  console.warn('WARN: Could not detect login UI from HTML (check in Safari after Publish)');
}

console.log('');
if (fail) {
  console.error('=== Fix (Terminal only) ===');
  console.error('  bash scripts/base44-partial-publish-wizard.sh   # 4 stale-trap files');
  console.error('  # or full re-publish: bash scripts/base44-publish-wizard.sh');
  console.error('  Click Publish in Base44 once, wait 60s');
  console.error('  node scripts/audit-base44-bundle.mjs');
  console.error('  node scripts/verify-base44-live.mjs');
  process.exit(1);
}
console.log('=== Base44 live matches git ===');
