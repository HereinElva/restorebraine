/**
 * Pre-flight for mac-resync-omega Phase 1 — runs on Mac or Linux (no Xcode needed).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const deploy =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const publishFile = resolve(`base44-publish-v${deploy}.txt`);
const publishBlocks = existsSync(publishFile)
  ? (readFileSync(publishFile, 'utf8').match(/BASE44 PATH:/g) ?? []).length
  : 0;

let fail = 0;

console.log('=== Resync Omega pre-flight (Phase 1 — Base44) ===\n');
console.log(`Git deploy: v${deploy}`);
console.log(`Publish pack: ${existsSync(publishFile) ? publishFile : 'MISSING'} (${publishBlocks} paths)\n`);

for (const script of ['verify-omega-baseline.mjs', 'verify-auth-flow.mjs']) {
  try {
    execSync(`node scripts/${script}`, { stdio: 'inherit' });
  } catch {
    fail += 1;
  }
  console.log('');
}

if (!existsSync(publishFile) || publishBlocks < 30) {
  console.error(`FAIL: Regenerate publish pack:`);
  console.error('  node scripts/embed-login-logo.mjs');
  console.error('  node scripts/generate-base44-publish.mjs');
  fail += 1;
} else {
  console.log(`OK: Publish pack has ${publishBlocks} BASE44 PATH blocks`);
}

console.log('');
try {
  execSync('node scripts/verify-base44-live.mjs', { stdio: 'inherit' });
} catch {
  console.log('');
  console.log('Expected until you Publish — complete Phase 1 in Base44, then re-run verify.');
  fail += 1;
}

console.log('');
if (fail) {
  console.error('=== Next on Mac ===');
  console.error('  bash scripts/base44-publish-wizard.sh');
  console.error('  docs/BASE44-PUBLISH.md');
  console.error('  node scripts/verify-base44-live.mjs');
  console.error('  bash scripts/mac-resync-omega.sh --native-only');
  process.exit(1);
}
console.log('=== Ready for Phase 2 (Capacitor native) ===');
console.log('  bash scripts/mac-resync-omega.sh --native-only');
