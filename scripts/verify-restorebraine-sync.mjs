/**
 * Three-way sync status: GitHub (git) · Capacitor (ios/public) · Base44 (live web).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

let fail = 0;

console.log('=== Restorebraine sync status ===\n');

// GitHub / local git
const deploy = readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const build = readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

console.log('GITHUB (git — source of truth)');
console.log(`  branch:  ${branch}`);
console.log(`  commit:  ${commit}`);
console.log(`  build:   v${build} · deploy v${deploy}`);
console.log('');

// Capacitor ios/public
console.log('CAPACITOR (ios/App/App/public)');
const pubIndex = resolve('ios/App/App/public/index.html');
if (!existsSync(pubIndex)) {
  console.log('  status:  NOT BUILT — run bash scripts/mac-build.sh');
  fail += 1;
} else {
  const html = readFileSync(pubIndex, 'utf8');
  const entry = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
  const iosDeploy = html.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1] ?? '?';
  const stamp = existsSync(resolve('ios/App/App/BUILD_STAMP.txt'))
    ? readFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), 'utf8').trim()
    : '?';
  const capConfig = existsSync(resolve('ios/App/App/capacitor.config.json'))
    ? readFileSync(resolve('ios/App/App/capacitor.config.json'), 'utf8')
    : '';
  const hosted = capConfig.includes('restorebraine.base44.app');
  console.log(`  deploy:  v${iosDeploy} (source v${build})`);
  console.log(`  stamp:   ${stamp}`);
  console.log(`  entry:   ${entry}`);
  console.log(`  mode:    ${hosted ? 'hosted (Omega shell)' : 'bundled (full app in iPhone)'}`);
  if (iosDeploy !== build) {
    console.log(`  status:  STALE — ios v${iosDeploy} != git v${build}. Run npm run build:native-local`);
    fail += 1;
  } else if (entry !== '?') {
    okCapacitor(true);
  } else {
    okCapacitor(false);
  }
}

function okCapacitor(ok) {
  if (ok) console.log('  status:  OK (bundle ready for Xcode)');
  else { console.log('  status:  FAIL'); fail += 1; }
}

console.log('');

// Base44 live (optional for bundled native)
console.log('BASE44 (live website — optional for bundled iPhone build)');
let liveDeploy = '?';
try {
  const liveHtml = execSync('curl -sL --max-time 15 https://restorebraine.base44.app', { encoding: 'utf8' });
  liveDeploy = liveHtml.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
    ?? liveHtml.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1]
    ?? '?';
  console.log(`  live:    v${liveDeploy}`);
  if (liveDeploy === deploy) {
    console.log('  status:  OK (matches git)');
  } else {
    console.log(`  status:  OUT OF SYNC (git v${deploy}) — OK if using bundled mac-build.sh`);
  }
} catch {
  console.log('  status:  could not reach (network)');
}

console.log('');
console.log('Architecture:');
console.log('  Bundled (default): iPhone = full git app. Base44 can lag.');
console.log('  Hosted (--hosted): iPhone = thin shell → Base44 live (Omega 1.0.1 build 3)');
console.log('');

try {
  execSync('node scripts/verify-omega-baseline.mjs', { stdio: 'inherit' });
} catch { fail += 1; }
console.log('');
try {
  execSync('node scripts/verify-restorebraine-1.0.1.mjs', { stdio: 'inherit' });
} catch { fail += 1; }

console.log('');
if (fail) {
  console.error('=== SYNC: fix issues above, then bash scripts/mac-build.sh ===');
  process.exit(1);
}
console.log('=== SYNC: git + 1.0.1 features OK ===');
console.log('Next: bash scripts/mac-build.sh --no-git');
