#!/usr/bin/env node
/**
 * Print exactly what the iPhone will load after the last Mac build.
 * Run after: npm run apply:v87-from-omega3 or npm run fix:no-change
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    return '';
  }
}

const iosCap = read('ios/App/App/capacitor.config.json');
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
const indexHtml = read('ios/App/App/public/index.html');
const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '(missing — run npm run build:native-local)';
const appJs = existsSync(resolve('ios/App/App/public/assets'))
  ? readdirSync(resolve('ios/App/App/public/assets')).filter((f) => f.startsWith('App-') && f.endsWith('.js'))
  : [];
const hosted = iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app');

console.log(`
══════════════════════════════════════════════════════════════
 WHAT YOUR IPHONE WILL LOAD (after Xcode Run)
══════════════════════════════════════════════════════════════
 BUILD_STAMP:     ${stamp || '(missing)'}
 MODE:            ${hosted ? 'HOSTED → https://restorebraine.base44.app (Base44 CDN)' : 'BUNDLED → capacitor://localhost ios/public'}
 Bundled entry:   ${entry}
 Bundled App.js:  ${appJs[0] ?? '(none)'}
══════════════════════════════════════════════════════════════
`);

if (hosted) {
  console.log('✓ Hosted mode OK. Phone loads live Base44 CDN.');
  console.log('  UI changes need Base44 Publish: npm run base44:export-pack');
  console.log('  Mac terminal UI: npm run apply:v87-from-omega3 (bundled default)\n');
  process.exit(0);
}

if (!existsSync('ios/App/App/public/assets')) {
  console.log('✗ ios/App/App/public missing — bundled build did not complete\n');
  process.exit(2);
}

const appJsName = appJs[0];
let appSource = '';
if (appJsName) {
  try {
    appSource = read(`ios/App/App/public/assets/${appJsName}`);
  } catch {}
}
const hasSignInFeedback = appSource.includes('Opening sign in');
const hasNativeOAuthBridge = read('ios/App/App/AppDelegate.swift').includes('ASWebAuthenticationSession');

console.log('✓ Bundled mode OK. After Xcode Run, look for green bar at bottom:');
console.log(`  BUNDLED · ${stamp} · ${entry}\n`);

if (!hasSignInFeedback) {
  console.log('✗ STALE ios/public — bundled JS missing Sign In tap feedback');
  console.log('  git reset --hard restores old ios/public from git — you MUST rebuild:');
  console.log('  npm run apply:v87-from-omega3 -- --skip-sync');
  console.log('  Then: Delete app → Restart iPhone → Xcode Clean → Run\n');
  process.exit(3);
}

if (!hasNativeOAuthBridge) {
  console.log('⚠ AppDelegate missing native OAuth — git pull cursor/apple-privacy-plist-bacf\n');
}

console.log('✓ Bundled JS includes Sign In feedback ("Opening sign in…" on tap)');
console.log('If green bar shows an OLD stamp or index-*.js hash → phone has stale cache:');
console.log('  Delete app → Restart iPhone → Xcode Clean → Run\n');
