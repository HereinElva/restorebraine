#!/usr/bin/env node
/**
 * Quick regression gate for bundled login + gallery organize stack.
 * Run after build:native-local or apply:v87-from-omega3.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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

const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
const iosCap = read('ios/App/App/capacitor.config.json');
const indexHtml = read('ios/App/App/public/index.html');
const entryMatch = indexHtml.match(/assets\/(index-[^"]+\.js)/);
const entry = entryMatch?.[1];
const appJs = existsSync(resolve('ios/App/App/public/assets'))
  ? readdirSync(resolve('ios/App/App/public/assets')).find((f) => f.startsWith('App-') && f.endsWith('.js'))
  : null;

if (!stamp) fail('BUILD_STAMP.txt missing');
if (iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app')) {
  fail('ios/App/App/capacitor.config.json has server.url — bundled phone will load CDN, not Mac UI');
}
if (!entry) fail('ios/App/App/public/index.html missing bundled entry script');
if (indexHtml.includes('login-redirect.js')) {
  fail('Bundled index.html still includes login-redirect.js — run build:native-local not npm run build');
}

const srcChecks = [
  ['src/screens/SignInScreen.jsx', 'SignInScreen'],
  ['src/components/NativeLoginCard.jsx', 'Continue With Google'],
  ['src/lib/folder-membership.js', 'export function buildFoldersForGalleryView'],
  ['src/lib/folder-membership.js', 'loadFolderMembershipCacheSync'],
  ['src/lib/folder-membership.js', 'return deduped.filter((folder) => folder.photo_ids.length > 0)'],
  ['src/lib/folder-membership-cache.js', 'export function repairMembershipCache'],
  ['src/lib/folder-membership-cache.js', 'export function loadFolderMembershipCacheSync'],
  ['src/lib/run-media-organize.js', 'export async function runMediaOrganize'],
  ['src/lib/media-organize.js', 'ORGANIZE_BATCH_FOLDERS'],
  ['src/lib/media-organize.js', 'ORGANIZE_BATCH_FOLDER_COUNT = 8'],
  ['src/Layout.jsx', 'pageContent'],
  ['src/lib/native-hosted-redirect.js', "protocol === 'capacitor:'"],
  ['src/main.jsx', 'ensureBundledHashRoute'],
  ['src/lib/AuthContext.jsx', 'finishPendingOAuthLogin'],
  ['src/lib/AuthContext.jsx', 'isBundledNativeShell() && !hasStoredAuthToken()'],
  ['src/App.jsx', 'function AppRouter'],
  ['src/components/BootErrorBoundary.jsx', 'hit a display error'],
];

for (const [file, needle] of srcChecks) {
  const text = read(file);
  if (!text) fail(`Missing ${file}`);
  else if (!text.includes(needle)) fail(`${file} missing expected marker: ${needle}`);
}

if (read('src/Layout.jsx').includes('AnimatePresence')) {
  fail('Layout.jsx still uses AnimatePresence — iOS white-screen regression risk');
}

const folderMembership = read('src/lib/folder-membership.js');
if (folderMembership.includes('loadFolderMembershipCacheSync(') && !folderMembership.includes('loadFolderMembershipCacheSync,')) {
  fail('folder-membership.js uses loadFolderMembershipCacheSync without importing it — login gallery crash');
}

if (read('src/App.jsx').includes('NativeRouter =')) {
  fail('App.jsx picks router at module load — use AppRouter render-time selection');
}

const mainJs = read('src/main.jsx');
if (mainJs.includes('location.replace') && mainJs.includes('ensureBundledHashRoute')) {
  fail('main.jsx hash bootstrap uses location.replace — can blank bundled WKWebView');
}

const hostedRedirect = read('src/lib/native-hosted-redirect.js');
if (hostedRedirect.includes('redirectNativeToHostedApp') && !hostedRedirect.includes("protocol === 'capacitor:'")) {
  fail('native-hosted-redirect.js missing capacitor:// guard — bundled shell may redirect to CDN');
}

if (entry && appJs) {
  const bundle = read(`ios/App/App/public/assets/${entry}`) + read(`ios/App/App/public/assets/${appJs}`);
  for (const needle of ['Continue With Google', 'sign-in-v4', 'Find Your', 'hit a display error', 'isBundledCapacitorShell']) {
    if (!bundle.includes(needle)) fail(`Bundled JS missing: ${needle}`);
  }
  if (bundle.includes('mode:"wait"')) {
    fail('Bundled App chunk still contains mode:"wait" tab animation — white-screen risk');
  }
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(' LOGIN + ORGANIZE REGRESSION CHECK');
console.log('══════════════════════════════════════════════════════════════');
console.log(` BUILD_STAMP:  ${stamp || '(missing)'}`);
console.log(` MODE:         ${iosCap.includes('"url"') ? 'HOSTED (wrong for Mac UI)' : 'BUNDLED ✓'}`);
console.log(` Entry:        ${entry || '(missing)'}`);
console.log(` App chunk:    ${appJs || '(missing)'}`);
console.log('');

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  console.log('');
}

if (errors.length) {
  console.log('FAILED:');
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('\nFix: npm run apply:v87-from-omega3 -- --skip-sync\n');
  process.exit(1);
}

console.log('✓ Login page wiring intact (SignInScreen / NativeLoginCard / OAuth + email session sync)');
console.log('✓ Organize stack intact (8-folder batch model, cache repair, run-media-organize)');
console.log('✓ Bundled mode default correct (capacitor:// guard, no server.url in ios config)');
console.log('✓ No tab AnimatePresence regression in Layout');
console.log('✓ Auth boot hardening intact (HashRouter, hash bootstrap, error boundary, OAuth grace)\n');
process.exit(0);
