#!/usr/bin/env node
/**
 * Gate all five post-v87 failure patterns before builds or iPhone tests.
 * Terminal can verify GitHub + Capacitor + live Base44 probes.
 * Base44 Publish itself is browser-only — gate tells you when it's required.
 */
import { PATTERNS, evaluateAllPatterns } from './lib/five-pattern-checks.mjs';

const results = evaluateAllPatterns();
let blocked = 0;

console.log('═══════════════════════════════════════════════════════════════');
console.log(' FIVE-PATTERN GATE — block post-v87 regressions');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const p of PATTERNS) {
  const r = results[p.id];
  const ok = r?.ok ?? false;
  if (!ok) blocked += 1;
  console.log(`  ${ok ? '✓' : '✗'} Pattern ${p.id}: ${p.name}`);
  console.log(`      ${p.symptom}`);
  console.log(`      → ${p.fix}`);
  if (!ok && r?.detail) console.log(`      (${r.detail})`);
  console.log('');
}

console.log('───────────────────────────────────────────────────────────────');
if (blocked) {
  console.log(` GATE BLOCKED — ${blocked}/5 patterns failing`);
  console.log('');
  console.log(' Terminal fixes (run in order):');
  console.log('   npm run sync:branch          # GitHub reset');
  console.log('   npm run cap:hosted           # lock hosted mode');
  console.log('   npm run build:web            # dist for chunk comparison');
  console.log('   npm run align:all            # full three-layer sync');
  console.log('');
  console.log(' Base44 (browser — no CLI exists):');
  console.log('   npm run base44:export-pack   # 43 files to paste');
  console.log('   npm run align:watch          # poll until Publish done');
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(1);
}

console.log(' GATE PASSED — all five patterns clear');
console.log(' Safe to Xcode Clean → Run on iPhone');
console.log(' After ANY src/ change: Base44 Publish → npm run align:all');
console.log('═══════════════════════════════════════════════════════════════\n');
