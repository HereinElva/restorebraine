import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const deploy = Number(read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? NaN);
const buildNum = Number(read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? NaN);
const indexMeta = Number(read('index.html').match(/content="v(\d+)"/)?.[1] ?? NaN);
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
const pbxVersions = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]));
const scrub = read('public/native-ui-scrub.js').match(/StripePatchVersion = (\d+)/)?.[1];
const capRoot = read('capacitor.config.json');
const capIos = read('ios/App/App/capacitor.config.json');
const stripeInCap = /stripe\.com|checkout\.stripe/.test(capRoot + capIos);
const stripeInHostedScript = /stripe\.com/.test(read('scripts/use-local-native-bundle.mjs'));

let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

check('DEPLOY_BUILD set', Number.isFinite(deploy), `v${deploy}`);
check('BUILD_NUMBER matches DEPLOY_BUILD', buildNum === deploy, `build=${buildNum} deploy=${deploy}`);
check('index.html meta matches DEPLOY_BUILD', indexMeta === deploy, `meta=v${indexMeta}`);
check(
  'Xcode CURRENT_PROJECT_VERSION matches DEPLOY_BUILD',
  pbxVersions.length > 0 && pbxVersions.every((v) => v === deploy),
  pbxVersions.join(', ')
);
check('Stripe scrub v293', scrub === '293', `v${scrub ?? '?'}`);
check('capacitor.config.json has no stripe.com', !stripeInCap);
check('ios capacitor.config.json has no stripe.com', !/stripe\.com/.test(capIos));
check('use-local-native-bundle.mjs does not inject stripe.com', !stripeInHostedScript);
check('folder-server-sync.js present', existsSync('src/lib/folder-server-sync.js'));

if (failed) {
  console.error('\nRun: node scripts/sync-build-numbers.mjs');
  console.error('Fix stripe injection in scripts/use-local-native-bundle.mjs if needed.');
  process.exit(1);
}

console.log(`\nBuild sync OK at v${deploy}. Safe to run ios:prepare / build:android.`);
