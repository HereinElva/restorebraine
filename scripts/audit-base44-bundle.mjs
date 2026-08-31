/**
 * Full Base44 + ghost-build audit.
 * Detects "no change" when deploy marker updates but Vite bundle stays stale.
 *
 * Usage: node scripts/audit-base44-bundle.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE_URL = 'https://restorebraine.base44.app';
const KNOWN_STALE_BUNDLES = [
  'index-mlcqt5ef.js',
  'index-DVkubWP5.js',
  'index-CGrESmC2.js',
];
const KNOWN_GHOST_ASSETS = [
  'App-CTDy7dds.js',
  'App-exbviQF4.js',
];
const REQUIRED_BUNDLE_MARKERS = [
  { id: 'folder-claim', pattern: 'claimOrphanedData', label: 'folder persistence (claimOrphanedData invoke)' },
  { id: 'folder-filter', pattern: 'Folder.filter', label: 'folder list scoped by user (listUserFolders)' },
  { id: 'payment-modal', pattern: 'data-rb-payment-modal', label: 'iPhone payment modal fix' },
  { id: 'stripe-inapp', pattern: 'openInWebView', label: 'Stripe in-app checkout' },
];
const PUBLISH_SOURCES = [
  'scripts/base44-publish-wizard.sh',
  'scripts/base44-copy-one.sh',
  'scripts/list-base44-publish-files.mjs',
  'scripts/generate-base44-publish.mjs',
];
const REQUIRED_PUBLISH_PATHS = [
  'src/lib/folder-server-sync.js',
  'src/lib/folder-membership.js',
  'src/lib/run-media-organize.js',
  'src/components/gallery/CustomFolderButton.jsx',
  'src/components/upload/PaymentModal.jsx',
  'src/lib/stripe-checkout.js',
  'src/pages/Account.jsx',
  'public/native-ui-scrub.js',
  'index.html',
  'src/deploy-marker.js',
];

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

function fetchLiveHtml() {
  return execSync(`curl -sL --max-time 20 '${LIVE_URL}/?nocache=${Date.now()}'`, { encoding: 'utf8' });
}

function fetchLiveText(path) {
  return execSync(`curl -sL --max-time 20 '${LIVE_URL}${path}'`, { encoding: 'utf8' });
}

function headStatus(path) {
  try {
    return execSync(`curl -sI --max-time 15 '${LIVE_URL}${path}'`, { encoding: 'utf8' })
      .match(/^HTTP\/[^\s]+ (\d+)/m)?.[1] ?? '?';
  } catch {
    return '?';
  }
}

const localDeploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const localBuild = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const indexMeta = read('index.html').match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1] ?? '?';

let html = '';
try {
  html = fetchLiveHtml();
} catch (error) {
  console.error('FAIL: could not fetch live site:', error.message);
  process.exit(1);
}

const liveDeploy = html.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
  ?? html.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1]
  ?? '?';
const liveBundle = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'unknown';
const liveCss = html.match(/assets\/(index-[^"]+\.css)/)?.[1] ?? 'unknown';
const hasStripeGuard = /restorebraine-stripe-checkout/i.test(html);

let liveBundleBody = '';
try {
  liveBundleBody = fetchLiveText(`/assets/${liveBundle}`);
} catch {
  liveBundleBody = '';
}

const scrubBody = fetchLiveText('/native-ui-scrub.js');
const scrubVersion = scrubBody.match(/v(\d+)/)?.[0] ?? 'unknown';

console.log('══════════════════════════════════════════════════════════════');
console.log('  RESTOREBRAINE FULL AUDIT — Base44 bundle + ghost builds');
console.log('══════════════════════════════════════════════════════════════\n');

console.log('1) VERSION STAMPS');
console.log(`   Git DEPLOY_BUILD:     v${localDeploy}`);
console.log(`   Git BUILD_NUMBER:     v${localBuild}`);
console.log(`   Git index.html meta:  v${indexMeta}`);
console.log(`   Live deploy meta:     v${liveDeploy}`);
console.log(`   Live JS bundle:       ${liveBundle}`);
console.log(`   Live CSS:             ${liveCss}`);
console.log(`   Live scrub script:    ${scrubVersion}`);
console.log('');

let blockers = [];
let warnings = [];

if (localBuild !== localDeploy || indexMeta !== localDeploy) {
  blockers.push(`Git version drift: deploy=${localDeploy} build=${localBuild} index=${indexMeta} — run node scripts/sync-build-numbers.mjs`);
}

if (liveDeploy !== localDeploy) {
  blockers.push(`Live deploy v${liveDeploy} ≠ git v${localDeploy} — paste index.html + deploy-marker.js → Publish`);
}

console.log('2) STALE BUNDLE (primary "no change" cause)');
if (KNOWN_STALE_BUNDLES.includes(liveBundle)) {
  blockers.push(`Live bundle is KNOWN STALE hash: ${liveBundle} — Base44 did not rebuild JS after Publish`);
  console.log(`   FAIL: bundle still ${liveBundle} (known stale)`);
} else {
  console.log(`   OK: bundle hash changed (${liveBundle})`);
}
console.log('');

console.log('3) BUNDLE CONTENT MARKERS');
for (const marker of REQUIRED_BUNDLE_MARKERS) {
  const present = liveBundleBody.includes(marker.pattern);
  const status = present ? 'OK  ' : 'MISS';
  console.log(`   ${status}: ${marker.label}`);
  if (!present) {
    blockers.push(`Live bundle missing ${marker.label} (${marker.pattern})`);
  }
}
console.log('');

console.log('4) GHOST CDN ASSETS (old files still served, not in index.html)');
for (const asset of KNOWN_GHOST_ASSETS) {
  const code = headStatus(`/assets/${asset}`);
  const referenced = html.includes(asset);
  if (code === '200') {
    const tag = referenced ? 'REFERENCED (bad)' : 'orphan (ghost)';
    console.log(`   HTTP ${code}: assets/${asset} — ${tag}`);
    if (!referenced) warnings.push(`Ghost asset still on CDN: assets/${asset} (HTTP 200, not referenced)`);
    else blockers.push(`index.html still references ghost asset ${asset}`);
  } else {
    console.log(`   HTTP ${code}: assets/${asset} — gone`);
  }
}
console.log('');

console.log('5) PUBLISH SCRIPT COMPLETENESS (why Base44 sandbox lacks new files)');
for (const src of PUBLISH_SOURCES) {
  const body = read(src);
  const missing = REQUIRED_PUBLISH_PATHS.filter((p) => !body.includes(p));
  if (missing.length) {
    console.log(`   FAIL: ${src} missing ${missing.length} required paths`);
    missing.forEach((p) => console.log(`         - ${p}`));
    blockers.push(`${src} missing: ${missing.join(', ')}`);
  } else {
    console.log(`   OK: ${src}`);
  }
}
console.log('');

console.log('6) LOCAL BUILD CHECK (expected after full Publish)');
if (existsSync('dist/index.html')) {
  const distHtml = read('dist/index.html');
  const distBundle = distHtml.match(/assets\/(index-[^"]+\.js)/)?.[1];
  const distBody = distBundle && existsSync(`dist/assets/${distBundle}`)
    ? read(`dist/assets/${distBundle}`)
    : '';
  const distMarkers = REQUIRED_BUNDLE_MARKERS.filter((m) => distBody.includes(m.pattern)).map((m) => m.id);
  console.log(`   dist bundle: ${distBundle ?? 'unknown'}`);
  console.log(`   dist markers: ${distMarkers.join(', ') || 'none'}`);
  if (distMarkers.length < REQUIRED_BUNDLE_MARKERS.length) {
    warnings.push('Local dist build missing some markers — run npm run build:web');
  }
} else {
  console.log('   (no dist/ — run npm run build:web to compare)');
}
console.log('');

console.log('7) NATIVE GHOST-BUILD SOURCES');
const stripeInHostedScript = /stripe\.com/.test(read('scripts/use-local-native-bundle.mjs'));
const capConfig = read('capacitor.config.json');
const stripeInAllowNav = /stripe\.com/.test(capConfig);
console.log(`   use-local-native-bundle injects stripe.com: ${stripeInHostedScript ? 'YES (bad)' : 'no'}`);
console.log(`   capacitor.config allowNavigation stripe:  ${stripeInAllowNav ? 'YES (bad for in-app)' : 'no'}`);
if (stripeInHostedScript) blockers.push('scripts/use-local-native-bundle.mjs still injects stripe.com on build');
if (stripeInAllowNav) warnings.push('capacitor.config.json still lists stripe.com in allowNavigation');
console.log('');

console.log('8) INDEX.HTML PARTIAL UPDATE TRAP');
console.log(`   Stripe inline guard in live HTML: ${hasStripeGuard ? 'yes' : 'no'}`);
console.log(`   Deploy meta can update WITHOUT bundle rebuild if only index.html/scrub pasted.`);
if (liveDeploy === localDeploy && KNOWN_STALE_BUNDLES.includes(liveBundle)) {
  blockers.push('Deploy stamp v' + localDeploy + ' updated but JS bundle unchanged — partial Publish detected');
}
console.log('');

console.log('══════════════════════════════════════════════════════════════');
if (blockers.length === 0) {
  console.log('  PASS — Live bundle matches git expectations');
  if (warnings.length) {
    console.log('\n  Warnings:');
    warnings.forEach((w) => console.log(`    • ${w}`));
  }
  process.exit(0);
}

console.log(`  FAIL — ${blockers.length} blocker(s)\n`);
blockers.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));

console.log('\n  FIX — paste ALL files below into Base44 Code editor, Save each, Publish ONCE:\n');
REQUIRED_PUBLISH_PATHS.forEach((p, i) => {
  const note = p === 'src/lib/folder-server-sync.js' || p === 'src/lib/run-media-organize.js'
    ? ' (CREATE new file in Base44 if missing)'
    : '';
  console.log(`    ${String(i + 1).padStart(2)}. ${p}${note}`);
});

console.log('\n  Verify after Publish:');
console.log('    node scripts/audit-base44-bundle.mjs');
console.log('    # bundle hash must NOT be index-mlcqt5ef.js');
console.log('    # must show claimOrphanedData + data-rb-payment-modal in bundle\n');

if (warnings.length) {
  console.log('  Warnings:');
  warnings.forEach((w) => console.log(`    • ${w}`));
}

process.exit(1);
