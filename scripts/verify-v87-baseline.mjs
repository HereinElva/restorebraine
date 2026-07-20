#!/usr/bin/env node
/**
 * Verify repo matches the GitHub v87 baseline (nothing after f1b2505).
 * v87 UI born: 5762b16 | v87 OAuth fix: f1b2505 (branch tip)
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const V87 = '87';
const V87_UI_COMMIT = '5762b16';
const V87_TIP_COMMIT = 'f1b2505';
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
let originShort = head;
try {
  originShort = execSync('git rev-parse --short origin/cursor/apple-privacy-plist-bacf', { encoding: 'utf8' }).trim();
} catch {
  /* offline */
}

if (head !== V87_TIP_COMMIT) {
  errors.push(`HEAD is ${head}, need ${V87_TIP_COMMIT} — run: git fetch origin cursor/apple-privacy-plist-bacf && git reset --hard origin/cursor/apple-privacy-plist-bacf`);
}
if (originShort !== V87_TIP_COMMIT) {
  errors.push(`origin/cursor/apple-privacy-plist-bacf is ${originShort}, need ${V87_TIP_COMMIT}`);
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
if (!app.includes('SignedOutLanding')) errors.push('App.jsx missing SignedOutLanding (v87 UI from 5762b16)');
if (/NativeLoginProviders|NativePlatformLoginRedirect/.test(app)) {
  errors.push('App.jsx has post-v87 login components');
}

if (!existsSync('src/components/auth/SignedOutLanding.jsx')) {
  errors.push('Missing SignedOutLanding.jsx');
}

const cap = read('capacitor.config.json');
if (!cap.includes('restorebraine.base44.app')) errors.push('capacitor.config.json missing hosted server.url');
if (cap.includes('appStartPath')) errors.push('capacitor.config.json has appStartPath (bundled mode)');

for (const stale of [
  'scripts/reset-to-v87.sh',
  'public/native-shell-stabilizer.js',
  'ios/App/App/RestorebraineBridgeViewController.swift',
]) {
  if (existsSync(stale)) errors.push(`Post-v87 file still present: ${stale}`);
}

if (errors.length) {
  console.error('\nv87 baseline verify FAILED:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`
GitHub v87 records:
  ${V87_UI_COMMIT}  v87 UI introduced (SignedOutLanding, BUILD 87)
  ${V87_TIP_COMMIT}  v87 tip — OAuth fix, nothing after this

Restore:
  git fetch origin cursor/apple-privacy-plist-bacf
  git reset --hard ${V87_TIP_COMMIT}
  bash scripts/mac-ios-setup.sh cursor/apple-privacy-plist-bacf
`);
  process.exit(1);
}

console.log('OK: GitHub v87 baseline verified');
console.log(`   HEAD ${head} = v87 tip (${V87_TIP_COMMIT})`);
console.log(`   UI from ${V87_UI_COMMIT} — Find Your Memories + Sign In`);
console.log(`   OAuth: restorebraine.base44.app/api/apps/auth/*`);
console.log('   Capacitor hosted → https://restorebraine.base44.app');
console.log('');
console.log('Phone still loads LIVE Base44 JS — Publish these files in Base44 editor:');
console.log('   src/lib/native-platform-guard.js, index.html, src/App.jsx, SignedOutLanding.jsx');
