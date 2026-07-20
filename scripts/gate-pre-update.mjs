#!/usr/bin/env node
/**
 * Pre-update gate — run BEFORE any new build or feature work.
 * Blocks re-introducing post-v87 patterns and confirms three-layer alignment.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BLOCKERS = [
  {
    id: 'hosted-only',
    rule: 'Never set appStartPath or run build:native-local — v87 is hosted Capacitor',
    check: () => {
      try {
        const cap = JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8'));
        return !cap.server?.appStartPath && cap.server?.url?.includes('restorebraine.base44.app');
      } catch {
        return false;
      }
    },
  },
  {
    id: 'no-login-rewrites',
    rule: 'Do not add NativeLoginCard, SignInScreen, LoginPage, NativeLoginProviders',
    check: () => {
      const forbidden = [
        'src/components/auth/NativeLoginCard.jsx',
        'src/components/auth/SignInScreen.jsx',
        'src/pages/LoginPage.jsx',
      ];
      return forbidden.every((p) => !existsSync(p));
    },
  },
  {
    id: 'oauth-origin',
    rule: 'OAuth must use DEFAULT_APP_ORIGIN (restorebraine.base44.app), not app.base44.com',
    check: () => {
      const guard = readFileSync('src/lib/native-platform-guard.js', 'utf8');
      return guard.includes('${DEFAULT_APP_ORIGIN}${path}') && !guard.includes('${BASE44_PLATFORM_URL}${path}');
    },
  },
  {
    id: 'base44-publish',
    rule: 'Any src/ change requires Base44 browser Publish — git push alone does not update iPhone UI',
    check: () => true,
  },
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' PRE-UPDATE GATE — block post-v87 regressions before new builds');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('WHY PAST BUILDS FAILED (do not repeat):\n');
console.log('  1. Updated GitHub + Xcode but not Base44 Publish → phone ran stale live JS');
console.log('  2. Flipped hosted ↔ bundled mode ~12 times → white screens, broken OAuth');
console.log('  3. Rewrote login UI ~15 times → session bridge + AppDelegate conflicts');
console.log('  4. Partial Publish (HTML meta only) → v87 label but broken OAuth bundle');
console.log('  5. BUILD_NUMBER bumps without three-layer sync → false sense of progress\n');

console.log('HARD RULES:\n');
let rulesOk = true;
for (const b of BLOCKERS) {
  const ok = b.check();
  console.log(`  ${ok ? '✓' : '✗'} ${b.rule}`);
  if (!ok) rulesOk = false;
}

console.log('\nRUNNING DIAGNOSTICS:\n');
const steps = [
  ['verify:v87', ['scripts/verify-v87-baseline.mjs']],
  ['verify:lingering', ['scripts/verify-no-post-v87-lingering.mjs', '--strict']],
  ['diagnose:oauth', ['scripts/diagnose-oauth-trace.mjs']],
  ['diagnose:sync', ['scripts/diagnose-sync-depth.mjs']],
];

let failed = 0;
for (const [name, args] of steps) {
  const r = run('node', args);
  console.log(`  ${r.ok ? '✓' : '✗'} ${name}`);
  if (!r.ok) failed += 1;
}

console.log('\n═══════════════════════════════════════════════════════════════');
if (!rulesOk || failed) {
  console.log(' GATE BLOCKED — fix failures above before shipping a new build.');
  console.log(' Run: npm run v87:playbook  (full post-mortem + nuke procedure)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(1);
}

console.log(' GATE PASSED — safe to proceed with updates.');
console.log(' After ANY src/ change: Base44 Publish → npm run diagnose:all');
console.log('═══════════════════════════════════════════════════════════════\n');
