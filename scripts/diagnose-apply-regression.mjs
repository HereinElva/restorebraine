#!/usr/bin/env node
/**
 * Diagnose apply:v87-from-omega3 state — bundled is the Mac terminal default (OK).
 *
 * Historical note (commit 14cfaef): apply default flipped HOSTED → BUNDLED.
 * That is intentional now — bundled lets Mac/Xcode control UI without Base44 Publish.
 * audit:v87-improvements is read-only and never causes regression.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return '';
  }
}

const iosCap = read('ios/App/App/capacitor.config.json');
const rootCap = read('capacitor.config.json');
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
const indexHtml = read('ios/App/App/public/index.html');
const entry = indexHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '(none)';
const hostedIos = iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app');
const hostedRoot = rootCap.includes('"url"') && rootCap.includes('restorebraine.base44.app');
const crossorigin = indexHtml.includes('crossorigin');
const appUsesSignedOut = read('src/App.jsx').includes('SignedOutLanding');
const appUsesOmegaLogin = read('src/App.jsx').includes('SignInScreen');
const bundledAssets = existsSync('ios/App/App/public/assets');

console.log(`
═══════════════════════════════════════════════════════════════
 APPLY STATE — bundled default vs hosted (CDN) baseline
═══════════════════════════════════════════════════════════════
`);

console.log('CURRENT STATE');
console.log(`  BUILD_STAMP:       ${stamp || '(missing)'}`);
console.log(`  ios config:        ${hostedIos ? 'HOSTED (live Base44 CDN)' : 'BUNDLED (Mac terminal UI — apply default)'}`);
console.log(`  root config:       ${hostedRoot ? 'HOSTED' : 'BUNDLED'}`);
console.log(`  bundled entry:     ${entry}`);
console.log(`  Login landing:     ${appUsesOmegaLogin ? 'SignInScreen / NativeLoginCard (Omega 3)' : read('src/App.jsx').includes('ClassicLoginLanding') ? 'ClassicLoginLanding (pre-v87 card)' : appUsesSignedOut ? 'SignedOutLanding (gallery shell)' : 'unknown — check App.jsx'}`);
console.log(`  crossorigin:       ${crossorigin ? 'YES ✗ breaks capacitor://' : 'no ✓'}`);
console.log('');

console.log('  AUTH FLOW (do not confuse):');
if (appUsesOmegaLogin) {
  console.log('    Step 1: SignInScreen — Continue With Google / Apple / Microsoft + email');
  console.log('    Step 2: Tap provider → OAuth (ASWebAuthenticationSession)');
  console.log('    Step 3: Gallery — Find Your Memories + search (after login)');
} else {
  console.log('    Step 1: Signed-out landing — Find Your Memories + Sign In button');
  console.log('    Step 2: Tap Sign In → Google OAuth');
  console.log('    Step 3: Gallery front page — Find Your Memories + search (after login)');
}
console.log('');

const problems = [];
if (!stamp) problems.push('BUILD_STAMP.txt missing — run apply or write-build-info');
if (crossorigin) problems.push('index.html has crossorigin — breaks capacitor:// bundled load');
if (!appUsesOmegaLogin && !appUsesSignedOut && !read('src/App.jsx').includes('ClassicLoginLanding')) {
  problems.push('App.jsx missing SignInScreen — login landing will be wrong');
}
if (!hostedIos && !bundledAssets) problems.push('ios/App/App/public/assets missing — bundled build incomplete');
if (!hostedIos && entry === '(none)') problems.push('bundled index.html has no entry script');

if (problems.length) {
  console.log('VERDICT: ✗ Problems detected');
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log('');
  console.log('RECOVERY:');
  console.log('  cd ~/restorebraine');
  console.log('  git fetch origin cursor/apple-privacy-plist-bacf');
  console.log('  git reset --hard origin/cursor/apple-privacy-plist-bacf');
  console.log('  npm install');
  console.log('  npm run apply:v87-from-omega3              # bundled (default)');
  console.log('  npm run apply:v87-from-omega3 -- --hosted  # live CDN instead');
  console.log('  # Delete app → Restart iPhone → Xcode Clean → Run');
  process.exit(1);
}

if (hostedIos) {
  console.log('VERDICT: ✓ HOSTED mode — phone loads live Base44 CDN');
  console.log('');
  console.log('Steady path: npm run align:all');
  console.log('Gallery src/ changes need Base44 Publish: npm run base44:export-pack');
  console.log('Do NOT run apply:v87-from-omega3 without --hosted (default is bundled, flips mode)');
  console.log('');
  console.log('If broken: Delete app → Restart → Clean → Run + Safari Web Inspector');
} else {
  console.log('VERDICT: ✓ BUNDLED mode — Mac terminal UI (apply default, expected green bar)');
  console.log('');
  console.log('Steady path:');
  console.log('  npm run prove:phone && npm run ghosts:prove-apply && npm run gate:mode');
  console.log('  Delete app → Restart iPhone → Xcode Clean → Run (every build)');
  console.log('');
  console.log('Do NOT run: npm run fix:no-change (switches to HOSTED / CDN)');
  console.log('After git reset --hard: npm run apply:v87-from-omega3 -- --skip-sync (reset wipes ios/public)');
  console.log('Only full apply when src/ changed: npm run apply:v87-from-omega3');
  console.log('');
  console.log(`Expected green bar: BUNDLED · ${stamp} · ${entry}`);
}

process.exit(0);
