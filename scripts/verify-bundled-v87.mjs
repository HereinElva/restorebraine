#!/usr/bin/env node
/**
 * Verify bundled v87: Omega 3 gallery stack + all corrections through f1b2505,
 * loaded from ios/public (capacitor://) — NOT live Base44 CDN.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { OMEGA3_TO_V87_COMMITS, V87_TIP, TIER_FULL } from './base44-v87-publish-manifest.mjs';

const V87 = '87';
const V87_UI_COMMIT = '5762b16';
const V87_TIP_COMMIT = V87_TIP;
/** Omega 3 gallery + v87 branch fixes — not "post-v87 breakdown" artifacts */
const ALLOWED_AFTER_V87 = new Set([
  ...TIER_FULL,
  'src/screens/SignInScreen.jsx',
  'src/components/NativeLoginCard.jsx',
  'ios/App/App/AppDelegate.swift',
  'ios/App/App/BUILD_STAMP.txt',
  'ios/App/App/ghost-builds.txt',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/verify-bundle.sh',
  'capacitor.config.json',
]);
const APP_PATHS = [
  'src/',
  'index.html',
  'capacitor.config.json',
  'ios/App/App/AppDelegate.swift',
  'ios/App/App/Info.plist',
  'public/native-oauth-return.js',
  'public/login-redirect.js',
];
const errors = [];

function read(rel) {
  const p = resolve(rel);
  if (!existsSync(p)) {
    errors.push(`Missing: ${rel}`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

let basedOnV87 = false;
try {
  execSync(`git merge-base --is-ancestor ${V87_TIP_COMMIT} HEAD`, { stdio: 'ignore' });
  basedOnV87 = true;
} catch {
  errors.push(`HEAD ${head} is not based on v87 tip ${V87_TIP_COMMIT}`);
}

if (basedOnV87 && head !== V87_TIP_COMMIT) {
  const appChanged = execSync(
    `git diff --name-only ${V87_TIP_COMMIT} HEAD -- ${APP_PATHS.join(' ')}`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter((f) => f && !ALLOWED_AFTER_V87.has(f))
    .join('\n');
  if (appChanged) {
    errors.push(`App source changed after ${V87_TIP_COMMIT}: ${appChanged.replace(/\n/g, ', ')}`);
  }
}

const build = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1];
if (build !== V87) errors.push(`BUILD_NUMBER is v${build ?? '?'}, need v${V87}`);

if (!read('index.html').includes('content="v87"')) {
  errors.push('index.html deploy meta must be content="v87"');
}

const guard = read('src/lib/native-platform-guard.js');
if (!guard.includes('${DEFAULT_APP_ORIGIN}${path}')) {
  errors.push('native-platform-guard.js must use DEFAULT_APP_ORIGIN for OAuth (f1b2505 fix)');
}
if (guard.includes('${BASE44_PLATFORM_URL}${path}')) {
  errors.push('native-platform-guard.js still uses BASE44_PLATFORM_URL for auth (pre-f1b2505 broken OAuth)');
}

const app = read('src/App.jsx');
const usesOmegaLogin = app.includes('SignInScreen') && existsSync('src/components/NativeLoginCard.jsx');
const usesSignedOutShell = app.includes('SignedOutLanding');
if (!usesOmegaLogin && !usesSignedOutShell) {
  errors.push('App.jsx must route SignInScreen (Omega 3) or SignedOutLanding (v87 gallery shell)');
}
if (/NativeLoginProviders|NativePlatformLoginRedirect/.test(app)) {
  errors.push('App.jsx has post-v87 login components');
}

if (usesOmegaLogin) {
  if (!existsSync('src/screens/SignInScreen.jsx')) errors.push('Missing src/screens/SignInScreen.jsx');
  if (!read('src/components/NativeLoginCard.jsx').includes('Continue With Google')) {
    errors.push('NativeLoginCard.jsx missing provider buttons');
  }
} else if (!existsSync('src/components/auth/SignedOutLanding.jsx')) {
  errors.push('Missing SignedOutLanding.jsx');
}

if (!existsSync('src/lib/gallery-organize-snapshot.js')) {
  errors.push('Missing gallery-organize-snapshot.js (Omega 3 folder persistence)');
}
if (!existsSync('src/lib/run-media-organize.js')) {
  errors.push('Missing run-media-organize.js (Omega 3 multi-batch organize)');
}
if (!read('src/components/gallery/PullToRefresh.jsx').includes('REFRESH_SAFETY_MS')) {
  errors.push('PullToRefresh missing 6s safety timeout (Omega 3 fix)');
}
if (read('src/pages/Gallery.jsx').includes('SignInScreen')) {
  errors.push('Gallery.jsx still references SignInScreen (post-v87 login rewrite)');
}

if (!existsSync('src/lib/native-media-input.js')) {
  errors.push('Missing native-media-input.js (v83 upload picker fix)');
}

const infoPlist = read('ios/App/App/Info.plist');
if (!infoPlist.includes('NSCameraUsageDescription')) {
  errors.push('Info.plist missing privacy usage descriptions (17af6de App Store 5.1.1)');
}

const iosCap = read('ios/App/App/capacitor.config.json');
if (iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app')) {
  errors.push('ios/App/App/capacitor.config.json still has server.url — run build:native-local (bundled mode)');
}

const publicDir = resolve('ios/App/App/public');
if (!existsSync(publicDir)) {
  errors.push('Missing ios/App/App/public — run npm run build:native-local');
} else {
  try {
    const count = execSync('find ios/App/App/public -type f | wc -l', { encoding: 'utf8' }).trim();
    if (Number(count) < 5) errors.push(`ios/App/App/public has only ${count} files — rebuild bundled UI`);
  } catch {
    errors.push('Could not inspect ios/App/App/public');
  }
}

for (const stale of [
  'scripts/reset-to-v87.sh',
  'public/native-shell-stabilizer.js',
  'ios/App/App/RestorebraineBridgeViewController.swift',
]) {
  if (existsSync(stale)) errors.push(`Post-v87 file still present: ${stale}`);
}

if (errors.length) {
  console.error('\nBundled v87 verify FAILED:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`
Restore Omega 3 gallery + v87 corrections (bundled, terminal-controlled):
  npm run apply:v87-from-omega3
`);
  process.exit(1);
}

console.log('OK: Bundled v87 verified (Omega 3 gallery + v87 corrections)');
console.log(`   HEAD ${head} (app code = ${V87_TIP_COMMIT})`);
console.log(`   Login: ${usesOmegaLogin ? 'SignInScreen / NativeLoginCard (Omega 3)' : `SignedOutLanding (${V87_UI_COMMIT})`}`);
console.log(`   Phone loads: capacitor:// bundled ios/public (NOT Base44 CDN)`);
console.log('');
console.log('Corrections included since omega-3:');
for (const { sha, note } of OMEGA3_TO_V87_COMMITS) {
  console.log(`   ${sha.slice(0, 7)}  ${note}`);
}
