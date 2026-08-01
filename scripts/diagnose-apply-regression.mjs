#!/usr/bin/env node
/**
 * Diagnose white screen after npm run apply:v87-from-omega3
 * Root cause: apply used to force BUNDLED (capacitor://) — v87 baseline is HOSTED.
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

console.log(`
═══════════════════════════════════════════════════════════════
 APPLY REGRESSION DIAGNOSIS — white screen after apply:v87-from-omega3
═══════════════════════════════════════════════════════════════
`);

console.log('WHAT YOU RAN');
console.log('  git reset --hard origin/cursor/apple-privacy-plist-bacf');
console.log('  npm run apply:v87-from-omega3   ← switched phone to BUNDLED mode');
console.log('  npm run audit:v87-improvements  ← read-only audit (did not cause regression)');
console.log('');

console.log('CURRENT STATE');
console.log(`  BUILD_STAMP:     ${stamp || '(missing)'}`);
console.log(`  ios config:      ${hostedIos ? 'HOSTED ✓' : 'BUNDLED ✗ (white screen risk)'}`);
console.log(`  root config:     ${hostedRoot ? 'HOSTED' : 'BUNDLED'}`);
console.log(`  bundled entry:   ${entry}`);
console.log(`  crossorigin:     ${crossorigin ? 'YES ✗ breaks capacitor://' : 'no ✓'}`);
console.log('');

console.log('WHY IT REGRESSED');
console.log('  v87 baseline = HOSTED (server.url → restorebraine.base44.app)');
console.log('  apply:v87-from-omega3 used to run build:native-local and REMOVE server.url');
console.log('  Phone then loads capacitor:// bundled ios/public — known white-screen path');
console.log('  audit:v87-improvements only checks files; it does not change build mode');
console.log('');

if (!hostedIos) {
  console.log('VERDICT: ✗ REGRESSION — phone is in BUNDLED mode (not the working hosted setup)');
  console.log('');
  console.log('RECOVERY (restores the nearly-perfect hosted state):');
  console.log('  cd ~/restorebraine');
  console.log('  npm run fix:no-change');
  console.log('  # Delete app → Restart iPhone → Xcode Clean Build Folder → Run');
  console.log('');
  console.log('Omega 3 gallery source is still in git after port — publish UI to Base44 when ready:');
  console.log('  npm run base44:export-pack');
  process.exit(1);
}

console.log('VERDICT: ✓ HOSTED mode — phone should load live Base44 (not white screen from bundled)');
console.log('');
console.log('If still white after hosted:');
console.log('  npm run audit:interference');
console.log('  npm run ghosts:audit-all');
console.log('  Safari Web Inspector → check JS console on device');
process.exit(0);
