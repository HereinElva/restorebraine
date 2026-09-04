/**
 * Blindspot matrix — which audits PASS while the iPhone still shows no change.
 * Run after any "PASS" to see what was NOT verified.
 *
 * Usage: node scripts/audit-blindspots.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE = 'https://restorebraine.base44.app';

function read(p) {
  return existsSync(p) ? readFileSync(resolve(p), 'utf8') : '';
}

function curl(path) {
  try {
    return execSync(`curl -sL --max-time 20 '${LIVE}${path}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

const html = curl('/?t=' + Date.now());
const guard = curl('/hosted-runtime-guard.js');
const bundle = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const deploy = html.match(/content="v(\d+)"/)?.[1] ?? '?';

const gitDeploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const cap = read('ios/App/App/capacitor.config.json');
const hosted = cap.includes('restorebraine.base44.app');
const stripeNav = /stripe\.com/.test(cap);

const liveStripeBroken = html.includes('openInApp(u);return true');
const liveStripeOk = html.includes('return openInApp(u);}var a=Location');
const liveGuardOk = guard.includes('rbHostedRuntimeGuard');
const gitStripeOk = read('index.html').includes('return openInApp(u);}var a=Location');

/** @type {{ tool: string, typical: string, blindspot: string, liveNow: string, fix: string }[]} */
const rows = [
  {
    tool: 'git pull / mac-sync-github',
    typical: 'PASS — repo at v295',
    blindspot: 'Does not update Base44 CDN or iPhone UI',
    liveNow: `deploy v${deploy}, bundle ${bundle}`,
    fix: 'Base44 Publish (manual)',
  },
  {
    tool: 'mac-complete-rebuild / mac-build --hosted',
    typical: 'PASS — ios/public, server.url, BUILD_STAMP',
    blindspot: 'Shell only; runtime UI = Base44 live, not ios/public',
    liveNow: hosted ? 'hosted shell OK' : 'NOT HOSTED',
    fix: 'Base44 Publish first',
  },
  {
    tool: 'verify-xcode-app-bundle.sh',
    typical: 'PASS — App.app on Mac matches repo',
    blindspot: 'Does not check live index.html or guard on CDN',
    liveNow: liveStripeBroken ? 'live Stripe BROKEN' : liveStripeOk ? 'live Stripe OK' : '?',
    fix: 'verify-base44-publish-applied.sh',
  },
  {
    tool: 'verify-full-stack-sync.mjs',
    typical: 'PASS — full stack harmonized',
    blindspot: 'Xcode section skipped or warns; Base44 section 8 can fail separately',
    liveNow: `live bundle ${bundle}`,
    fix: 'audit-base44-bundle.mjs section 8',
  },
  {
    tool: 'verify-base44-live.mjs (old)',
    typical: 'PASS — deploy v295, bundle markers',
    blindspot: 'Used to miss broken Stripe intercept + old guard',
    liveNow: liveStripeBroken ? 'Stripe intercept BROKEN' : 'Stripe OK',
    fix: 'Use verify-base44-publish-applied.sh',
  },
  {
    tool: 'audit-base44 section 3',
    typical: 'PASS — claimOrphanedData, payment modal, openInWebView',
    blindspot: 'index.html + public/ can still be stale (section 8)',
    liveNow: liveGuardOk ? 'guard OK' : `guard OLD (${guard.length}b)`,
    fix: 'partial publish wizard + Publish click',
  },
  {
    tool: 'audit-base44 section 8',
    typical: 'FAIL when Publish not applied',
    blindspot: 'None — this is the real Base44 gate',
    liveNow: liveStripeBroken || !liveGuardOk ? 'FAIL (correct)' : 'PASS',
    fix: liveStripeBroken || !liveGuardOk ? 'Click Publish in Base44' : 'none',
  },
  {
    tool: 'verify-base44-publish-applied.sh',
    typical: 'PASS only when CDN actually changed',
    blindspot: 'Does not verify RuntimeDiagnostic in bundle',
    liveNow: liveStripeOk && liveGuardOk ? 'would PASS' : 'FAIL',
    fix: 'Publish + wait 60s',
  },
  {
    tool: 'Safari private tab',
    typical: 'Looks like web app works',
    blindspot: 'Stripe always external in Safari; not native InAppBrowser test',
    liveNow: 'Same CDN as native hosted app',
    fix: 'Test native app after Base44 PASS',
  },
  {
    tool: 'npm run build / write-build-info',
    typical: 'Build succeeds, version bumps',
    blindspot: 'Ghost version drift; does not publish to Base44',
    liveNow: `git v${gitDeploy}`,
    fix: 'Use build:web + sync-build-numbers only',
  },
  {
    tool: 'mac-resync-omega / --bundled',
    typical: 'Device shows something',
    blindspot: 'capacitor://localhost — ignores Base44 entirely',
    liveNow: hosted ? 'Do not use for App Store' : 'bundled active',
    fix: 'mac-build.sh --hosted only',
  },
];

console.log('══════════════════════════════════════════════════════════════');
console.log('  AUDIT BLINDSPOT MATRIX — what PASS hides');
console.log('══════════════════════════════════════════════════════════════\n');

console.log('  Hosted app UI chain:  Base44 CDN → server.url → iPhone WebView');
console.log('  Only Base44 Publish updates what the phone actually runs.\n');

console.log('  LIVE CDN RIGHT NOW:');
console.log(`    deploy:  v${deploy}`);
console.log(`    bundle:  ${bundle}`);
console.log(`    stripe:  ${liveStripeBroken ? 'BROKEN (openInApp; return true)' : liveStripeOk ? 'OK' : '?'}`);
console.log(`    guard:   ${liveGuardOk ? 'OK (rbHostedRuntimeGuard)' : `OLD (${guard.length} bytes)`}`);
console.log(`    git stripe fix present: ${gitStripeOk ? 'yes (not on CDN)' : 'no'}`);
console.log('');

const width = 28;
console.log(
  `  ${'Tool'.padEnd(width)} | ${'Typical PASS'.padEnd(22)} | Blindspot`,
);
console.log(`  ${'─'.repeat(width)} | ${'─'.repeat(22)} | ${'─'.repeat(40)}`);

for (const r of rows) {
  const flag =
    r.liveNow.includes('BROKEN') || r.liveNow.includes('OLD') || r.liveNow.includes('FAIL')
      ? '⚠'
      : r.liveNow.includes('OK') || r.liveNow.includes('PASS')
        ? '✓'
        : '·';
  console.log(`  ${flag} ${r.tool.padEnd(width - 2)} | ${r.typical.slice(0, 22).padEnd(22)} | ${r.blindspot.slice(0, 50)}`);
}

console.log('\n── CORRECT BUILD ORDER (no blindspots) ──\n');
console.log('  1. npm run base44:editor-check');
console.log('  2. bash scripts/base44-partial-publish-wizard.sh');
console.log('  3. Click PUBLISH in Base44 → wait for build');
console.log('  4. bash scripts/verify-base44-publish-applied.sh     ← must PASS');
console.log('  5. bash scripts/mac-full-shakedown.sh --rebuild');
console.log('  6. Xcode: Apple ID → Delete app → Clean → Run');
console.log('  7. node scripts/audit-full-shakedown.mjs             ← all layers PASS');
console.log('');

const blocked = liveStripeBroken || !liveGuardOk;
if (blocked) {
  console.log('  CURRENT BLOCKER: Step 3–4 (Base44 Publish not on CDN)');
  console.log('  Native/Xcode steps 5–6 cannot fix live index.html.\n');
  process.exit(1);
}

console.log('  Base44 CDN looks OK — proceed to native rebuild + Xcode Run.\n');
process.exit(0);
