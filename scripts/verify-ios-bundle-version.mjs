/**
 * Fail if ios/App/App/public is stale vs src/lib/build-info.js.
 * Prevents shipping v199 UI when source is v204+.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const buildNum = readFileSync(resolve(repo, 'src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1];
const iosIndex = resolve(repo, 'ios/App/App/public/index.html');

if (!buildNum) {
  console.error('FAIL: BUILD_NUMBER missing in src/lib/build-info.js');
  process.exit(1);
}

if (!existsSync(iosIndex)) {
  console.error('FAIL: ios/App/App/public/index.html missing — run npm run build:native-local');
  process.exit(1);
}

const html = readFileSync(iosIndex, 'utf8');
const iosDeploy = html.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1]
  ?? html.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1];

if (iosDeploy !== buildNum) {
  console.error(`FAIL: ios bundle is v${iosDeploy ?? '?'} but source is v${buildNum}`);
  console.error('      Run: npm run build:native-local');
  console.error('      Or:  bash scripts/mac-build.sh --no-git');
  process.exit(1);
}

if (html.includes('Loading Restorebraine')) {
  console.error('FAIL: ios/public/index.html still has pre-React loading shell');
  process.exit(1);
}

if (!html.includes('native-ui-scrub.js')) {
  console.error('FAIL: ios/public/index.html missing native-ui-scrub.js');
  process.exit(1);
}

const entry = html.match(/assets\/(index-[^"]+\.js)/)?.[1];
if (!entry || !existsSync(resolve(repo, 'ios/App/App/public/assets', entry))) {
  console.error(`FAIL: ios entry JS missing: ${entry ?? 'unknown'}`);
  process.exit(1);
}

console.log(`OK: ios bundle v${iosDeploy} matches source v${buildNum} (${entry})`);
