#!/usr/bin/env node
/**
 * Diagnose regression after npm run apply:v87-from-omega3
 *
 * ROOT CAUSE (commit 14cfaef, Aug 2026):
 *   apply default flipped HOSTED → BUNDLED. That one change caused the cascade:
 *   1. build:native-local removes server.url → phone loads capacitor:// not Base44 CDN
 *   2. wipe_build_debris + port-omega3-gallery rewrites src/ gallery files
 *   3. verify-bundled-v87 can fail mid-build → stale ios/public + ghost blocklist conflicts
 *   4. Stale OAuth token on device + bundled auth boot → infinite spinner (fixed in eb8cd80/898c152)
 *
 * audit:v87-improvements did NOT cause regression — it is read-only.
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

console.log(`
═══════════════════════════════════════════════════════════════
 APPLY REGRESSION DIAGNOSIS — why apply:v87-from-omega3 broke things
═══════════════════════════════════════════════════════════════
`);

console.log('WHAT YOU RAN (typical regression sequence)');
console.log('  git fetch + reset --hard origin/cursor/apple-privacy-plist-bacf');
console.log('  npm install');
console.log('  npm run apply:v87-from-omega3     ← was BUNDLED default (14cfaef) — main trigger');
console.log('  npm run audit:v87-improvements    ← READ-ONLY — did NOT undo anything');
console.log('');

console.log('WHY IT REGRESSED (retrace)');
console.log('  BEFORE (574d61d): apply default = HOSTED → phone loads restorebraine.base44.app');
console.log('  AFTER  (14cfaef): apply default = BUNDLED → phone loads capacitor:// ios/public');
console.log('  That mode flip changed which code path runs — not the audit.');
console.log('');
console.log('  Cascade when BUNDLED apply runs:');
console.log('    • git clean wipes ios/public → full rebuild required');
console.log('    • port-omega3-gallery overwrites Gallery.jsx + organize stack from omega-3 tag');
console.log('    • build:native-local failure leaves stale bundle or blocks new index-*.js (ghosts)');
console.log('    • Device stale OAuth token → auth boot spinner (until eb8cd80/898c152 fixes)');
console.log('    • fix:no-change switches back to HOSTED → looks like "improvements undone" (CDN vs Mac layer)');
console.log('');

console.log('CURRENT STATE');
console.log(`  BUILD_STAMP:       ${stamp || '(missing)'}`);
console.log(`  ios config:        ${hostedIos ? 'HOSTED ✓ (v87 baseline)' : 'BUNDLED (experimental)'}`);
console.log(`  root config:       ${hostedRoot ? 'HOSTED' : 'BUNDLED'}`);
console.log(`  bundled entry:     ${entry}`);
console.log(`  SignedOutLanding:  ${appUsesSignedOut ? 'yes ✓' : 'no — check App.jsx'}`);
console.log(`  crossorigin:       ${crossorigin ? 'YES ✗ breaks capacitor://' : 'no ✓'}`);
console.log('');

console.log('  AUTH FLOW (do not confuse):');
console.log('    Step 1: Signed-out landing — Find Your Memories + Sign In button');
console.log('    Step 2: Tap Sign In → Google OAuth');
console.log('    Step 3: Gallery front page — Find Your Memories + search (after login)');
console.log('');

if (!hostedIos) {
  console.log('VERDICT: ✗ BUNDLED mode — not the pre-regression hosted baseline');
  console.log('');
  console.log('RECOVERY (restores pre-apply hosted state):');
  console.log('  cd ~/restorebraine');
  console.log('  git fetch origin cursor/apple-privacy-plist-bacf');
  console.log('  git reset --hard origin/cursor/apple-privacy-plist-bacf');
  console.log('  npm install');
  console.log('  npm run apply:v87-from-omega3          # default hosted again');
  console.log('  # OR: npm run fix:no-change');
  console.log('  # Delete app → Restart iPhone → Xcode Clean → Run');
  console.log('');
  console.log('Bundled only when you explicitly need Mac terminal UI:');
  console.log('  npm run apply:v87-from-omega3 -- --bundled');
  process.exit(1);
}

console.log('VERDICT: ✓ HOSTED mode — matches pre-regression v87 baseline');
console.log('');
console.log('Phone loads live Base44 CDN. Gallery src/ changes need Base44 Publish.');
console.log('If still broken: Delete app → Restart → Clean → Run + Safari Web Inspector');
process.exit(0);
