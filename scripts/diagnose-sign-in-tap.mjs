#!/usr/bin/env node
/**
 * Verify bundled Sign In path — native ASWebAuthenticationSession + JS bridge.
 */
import { existsSync, readFileSync } from 'node:fs';

function read(rel) {
  try {
    return readFileSync(rel, 'utf8');
  } catch {
    return '';
  }
}

const delegate = read('ios/App/App/AppDelegate.swift');
const iosCap = read('ios/App/App/capacitor.config.json');
const bundled = !iosCap.includes('"url"') || !iosCap.includes('restorebraine.base44.app');

console.log(`
═══════════════════════════════════════════════════════════════
 SIGN IN TAP DIAGNOSIS — Step 2 (OAuth sheet must appear)
═══════════════════════════════════════════════════════════════
`);

console.log(`Phone mode: ${bundled ? 'BUNDLED (capacitor://)' : 'HOSTED (CDN)'}`);
console.log('');

const checks = [];

if (delegate.includes('ASWebAuthenticationSession')) {
  checks.push(['✓', 'Native ASWebAuthenticationSession (Swift — does not need Capacitor JS)']);
} else {
  checks.push(['✗', 'Missing ASWebAuthenticationSession in AppDelegate — pull latest branch']);
}

if (delegate.includes('action: \'openLogin\'') || delegate.includes('case "openLogin"')) {
  checks.push(['✓', 'JS → native openLogin message handler']);
} else {
  checks.push(['✗', 'Missing openLogin native message handler']);
}

if (delegate.includes('postNativeOpenLogin')) {
  checks.push(['✓', 'Bundled bridge calls postNativeOpenLogin first']);
} else {
  checks.push(['✗', 'Bundled bridge missing postNativeOpenLogin']);
}

if (delegate.includes('bundledOAuthBridgeScript')) {
  checks.push(['✓', 'bundledOAuthBridgeScript present']);
} else {
  checks.push(['✗', 'bundledOAuthBridgeScript missing']);
}

if (read('src/components/auth/SignedOutLanding.jsx').includes('Opening sign in')) {
  checks.push(['✓', 'Sign In button shows "Opening sign in…" feedback on tap']);
} else {
  checks.push(['⚠', 'Sign In button has no tap feedback — rebuild bundled assets']);
}

for (const [mark, msg] of checks) console.log(`  ${mark} ${msg}`);

console.log('');
console.log('WHAT "NO CHANGE" USUALLY MEANS');
console.log('  • Step 1 same after rebuild = EXPECTED (signed out landing)');
console.log('  • Tap Sign In, screen identical = BUG (OAuth sheet never opened)');
console.log('  • Button says "Opening sign in…" but no sheet = Xcode not rebuilt after AppDelegate change');
console.log('');
console.log('FIX (Mac + iPhone — both required)');
console.log('  npm run fix:sign-in');
console.log('  Delete app → Restart iPhone → Xcode Clean → Run');
console.log('');
console.log('AFTER TAP SIGN IN you must see Apple\'s Google login sheet (Step 2).');
console.log('Green bar may append "· opening OAuth…" when native bridge receives the tap.');
console.log('Step 1 UI stays until the sheet appears — that is normal.');
console.log('');

const failed = checks.some(([mark]) => mark === '✗');
process.exit(failed ? 1 : 0);
