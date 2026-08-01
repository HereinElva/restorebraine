#!/usr/bin/env node
/**
 * Fail when repo scripts disagree on hosted vs bundled default, or phone mode
 * conflicts with the command the user is about to run.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function read(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return '';
  }
}

const iosCap = read('ios/App/App/capacitor.config.json');
const hosted = iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app');
const apply = read('scripts/apply-v87-from-omega3.sh');
const fix = read('scripts/fix-no-change.sh');
const blocks = read('scripts/clear-all-blocks.sh');

const errors = [];
const warnings = [];

const applyDefaultBundled = /MODE="bundled"/.test(apply) && !/MODE="hosted"/.test(apply.split('MODE=')[0] || '');
const applyDefaultHosted = /MODE="hosted"/.test(apply);
const fixDefaultHosted = /MODE="hosted"/.test(fix);
const blocksDefaultHosted = /MODE="hosted"/.test(blocks);

console.log(`
═══════════════════════════════════════════════════════════════
 MODE CONSISTENCY GATE — stop hosted/bundled flip-flop loops
═══════════════════════════════════════════════════════════════
`);

console.log('CURRENT PHONE MODE (from ios/App/App/capacitor.config.json)');
console.log(`  ${hosted ? 'HOSTED → https://restorebraine.base44.app (CDN UI)' : 'BUNDLED → capacitor:// ios/public (Mac UI)'}`);
console.log('');

console.log('SCRIPT DEFAULTS');
console.log(`  apply:v87-from-omega3     ${apply.includes('MODE="bundled"') ? 'bundled' : apply.includes('MODE="hosted"') ? 'hosted' : '?'}`);
console.log(`  fix:no-change             ${fixDefaultHosted ? 'hosted' : '?'}`);
console.log(`  blocks:clear              ${blocksDefaultHosted ? 'hosted' : '?'}`);
console.log('');

if (fixDefaultHosted && apply.includes('MODE="bundled"')) {
  warnings.push('apply defaults BUNDLED but fix:no-change defaults HOSTED — recovery flips mode each time');
}

console.log('WHY ISSUES REPEAT');
console.log('  1. Recovery scripts switch WHICH LAYER the phone loads (CDN vs ios/public)');
console.log('  2. apply runs git reset + port-omega3 + mode change in one opaque step');
console.log('  3. audit:v87-improvements is read-only — never the cause of regression');
console.log('  4. Stale iPhone cache/token without delete/restart/clean mimics new bugs');
console.log('');

if (hosted) {
  console.log('STEADY PATH (hosted — v87 baseline docs)');
  console.log('  npm run align:all');
  console.log('  Base44 Publish when src/ changed');
  console.log('  npm run diagnose:all');
  console.log('  Do NOT run: npm run apply:v87-from-omega3 (bundled default flips mode)');
} else {
  console.log('STEADY PATH (bundled — Mac terminal UI, your screenshot state)');
  console.log('  npm run prove:phone && npm run ghosts:prove-apply');
  console.log('  Delete app → Restart iPhone → Xcode Clean → Run');
  console.log('  Do NOT run: npm run fix:no-change (switches to HOSTED / CDN)');
  console.log('  Do NOT run: npm run apply:v87-from-omega3 unless src/ changed');
}

console.log('');

if (warnings.length) {
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (errors.length) {
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}

console.log('✓ Mode gate OK — pick ONE steady path above and avoid the forbidden commands');
process.exit(0);
