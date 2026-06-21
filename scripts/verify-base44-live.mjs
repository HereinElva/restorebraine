/**
 * Compare live Base44 deploy stamp vs local git — detects GitHub/Base44/Capacitor drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE_URL = 'https://restorebraine.base44.app';

const localDeploy =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const localBuild =
  readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

let html = '';
try {
  html = execSync(`curl -sL --max-time 15 '${LIVE_URL}'`, { encoding: 'utf8' });
} catch (error) {
  console.error('FAIL: could not fetch', LIVE_URL, error.message);
  process.exit(1);
}

const liveDeploy = html.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
  ?? html.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1]
  ?? '?';
const liveBundle = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'unknown';
const hasMultiProvider = /Continue With Apple|Continue With Microsoft|Sign In With Email/i.test(html);
const hasOldSingleGoogle = /Continue with Google/i.test(html) && !hasMultiProvider;

console.log('=== Base44 live vs git ===\n');
console.log(`Live site:     ${LIVE_URL}`);
console.log(`Live deploy:   v${liveDeploy}  (bundle: ${liveBundle})`);
console.log(`Git deploy:    v${localDeploy}  (build: v${localBuild})`);
console.log('');

let fail = 0;

if (liveDeploy === '?' || liveDeploy !== localDeploy) {
  console.error(`FAIL: Base44 is v${liveDeploy} but git is v${localDeploy} — OUT OF SYNC`);
  console.error('       Safari + hosted Capacitor show OLD code until you Publish.');
  fail += 1;
} else {
  console.log('OK: Base44 deploy stamp matches git');
}

if (hasOldSingleGoogle) {
  console.error('FAIL: Live site still shows OLD login (single "Continue with Google" only)');
  console.error('       Publish base44-publish-v' + localDeploy + '.txt → Base44 Code editor → Publish');
  fail += 1;
} else if (hasMultiProvider) {
  console.log('OK: Live login has multi-provider card (Google / Apple / email)');
} else {
  console.warn('WARN: Could not detect login UI from HTML (check in Safari after Publish)');
}

console.log('');
if (fail) {
  console.error('=== Fix: ONE full publish from git (do not edit Base44 piecemeal) ===');
  console.error('  bash scripts/mac-start-fresh.sh --no-git');
  console.error('  open base44-publish-v' + localDeploy + '.txt → paste all paths → Publish');
  console.error('  node scripts/verify-base44-live.mjs');
  process.exit(1);
}
console.log('=== Base44 live matches git ===');
