#!/usr/bin/env node
/**
 * Run all read-only diagnostics in sequence. Optional --watch polls live bundle.
 */
import { spawnSync } from 'node:child_process';

const WATCH = process.argv.includes('--watch');
const INTERVAL = Number(process.argv.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? 30);

const steps = [
  { name: 'v87 baseline', cmd: 'node', args: ['scripts/verify-v87-baseline.mjs'] },
  { name: 'Post-v87 lingering scan', cmd: 'node', args: ['scripts/verify-no-post-v87-lingering.mjs', '--strict'] },
  { name: 'OAuth URLs (git + AppDelegate)', cmd: 'node', args: ['scripts/verify-oauth-urls.mjs'] },
  { name: 'OAuth trace (Sign In URL per layer)', cmd: 'node', args: ['scripts/diagnose-oauth-trace.mjs'] },
  { name: 'Deep sync (GitHub ↔ Base44 ↔ Capacitor)', cmd: 'node', args: ['scripts/diagnose-sync-depth.mjs'] },
  { name: 'Quick layers', cmd: 'node', args: ['scripts/diagnose-capacitor-base44.mjs'] },
];

function runOnce() {
  console.log(`\n${'═'.repeat(63)}`);
  console.log(` DIAGNOSTIC RUN — ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(63)}\n`);

  let failed = 0;
  for (const step of steps) {
    console.log(`\n▶ ${step.name}`);
    console.log(`${'─'.repeat(50)}`);
    const result = spawnSync(step.cmd, step.args, { stdio: 'inherit', encoding: 'utf8' });
    if (result.status !== 0) failed += 1;
  }

  console.log(`\n${'═'.repeat(63)}`);
  console.log(` RUN COMPLETE — ${steps.length - failed}/${steps.length} passed`);
  if (failed) {
    console.log(' Failures above — see npm run v87:playbook for root causes.');
    console.log(' Critical: live Base44 OAuth must use restorebraine.base44.app');
    console.log(' Re-run: npm run diagnose:all');
    console.log(' Watch live bundle: npm run diagnose:watch');
  } else {
    console.log(' All layers aligned — safe to Xcode Run on iPhone.');
    console.log(' After src/ changes: Base44 Publish → diagnose:all again.');
  }
  console.log(`${'═'.repeat(63)}\n`);
  return failed;
}

if (WATCH) {
  console.log(`Watching live Base44 every ${INTERVAL}s (Ctrl+C to stop)…`);
  let lastHash = '';
  for (;;) {
    try {
      const res = await fetch('https://restorebraine.base44.app', { headers: { 'cache-control': 'no-cache' } });
      const html = await res.text();
      const bundle = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
      const stamp = new Date().toISOString();
      if (bundle !== lastHash) {
        console.log(`\n[${stamp}] Live bundle changed: ${lastHash || '(none)'} → ${bundle}`);
        lastHash = bundle;
        runOnce();
      } else {
        process.stdout.write(`[${stamp}] Live bundle still ${bundle}\r`);
      }
    } catch (e) {
      console.error(`Watch error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, INTERVAL * 1000));
  }
} else {
  const failed = runOnce();
  process.exit(failed ? 1 : 0);
}
