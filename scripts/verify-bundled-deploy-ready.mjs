/**
 * Fail before Xcode Run if bundled iPhone build would still load hosted Base44 (old login).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

let fail = 0;
const bad = (msg) => {
  console.error(`FAIL: ${msg}`);
  fail += 1;
};
const ok = (msg) => console.log(`OK: ${msg}`);

const iosConfig = resolve('ios/App/App/capacitor.config.json');
const publicDir = resolve('ios/App/App/public');
const indexHtml = resolve(publicDir, 'index.html');
const bundledMode = resolve('ios/App/App/BUNDLED_MODE.txt');
const buildStamp = resolve('ios/App/App/BUILD_STAMP.txt');

console.log('=== Bundled deploy readiness (Option A) ===\n');

if (!existsSync(bundledMode)) {
  bad('ios/App/App/BUNDLED_MODE.txt missing — run: bash build-iphone.sh');
} else {
  ok('BUNDLED_MODE.txt present');
}

if (!existsSync(iosConfig)) {
  bad('ios/App/App/capacitor.config.json missing');
} else {
  const config = readFileSync(iosConfig, 'utf8');
  if (/"url"\s*:/.test(config)) {
    bad('capacitor.config.json still has server.url — app loads Base44 v162, NOT bundled login');
    console.error('      Fix: bash build-iphone.sh (must finish without errors)');
  } else {
    ok('capacitor.config.json has no server.url (bundled mode)');
  }
}

if (!existsSync(indexHtml)) {
  bad('ios/App/App/public/index.html missing — run: bash build-iphone.sh');
} else {
  const html = readFileSync(indexHtml, 'utf8');
  const entry = html.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];
  if (!entry) bad('index.html missing JS entry');
  else ok(`index.html entry ${entry}`);

  const assetsDir = resolve(publicDir, 'assets');
  const bundles = existsSync(assetsDir) ? readdirSync(assetsDir).filter((f) => f.endsWith('.js')) : [];
  const entryPath = entry ? resolve(assetsDir, entry) : null;
  const filesToScan = [entryPath, resolve(publicDir, 'apple-sign-in-logo.svg')].filter(Boolean);

  if (!existsSync(resolve(publicDir, 'apple-sign-in-logo.svg'))) {
    bad('apple-sign-in-logo.svg missing from ios/App/App/public/');
  } else {
    ok('apple-sign-in-logo.svg in bundle');
  }

  let js = '';
  if (entryPath && existsSync(entryPath)) js = readFileSync(entryPath, 'utf8');
  else if (bundles.length) js = readFileSync(resolve(assetsDir, bundles[0]), 'utf8');

  if (/Continue With Apple/i.test(js)) {
    bad('Bundle still has OLD login text "Continue With Apple"');
  } else if (!/Sign in with Apple/i.test(js)) {
    bad('Bundle missing HIG label "Sign in with Apple"');
  } else {
    ok('Bundle has "Sign in with Apple"');
  }

  if (!/data-rb-apple-logo/i.test(js)) {
    bad('Bundle missing Apple logo marker (data-rb-apple-logo)');
  } else {
    ok('Bundle includes Apple logo marker');
  }
}

if (existsSync(buildStamp)) {
  ok(`BUILD_STAMP ${readFileSync(buildStamp, 'utf8').trim()}`);
} else {
  bad('BUILD_STAMP.txt missing');
}

console.log('');
if (fail) {
  console.error('=== NOT READY for Xcode Run ===');
  console.error('If you Run anyway, iPhone will show "Continue With Apple" (hosted Base44).');
  console.error('After fixing, login must show "Sign in with Apple" + Build vN at bottom.');
  process.exit(1);
}

console.log('=== READY — now Xcode Clean → Run on iPhone ===');
console.log('After install, login MUST show:');
console.log('  • Sign in with Apple (with white logo)');
console.log('  • Build vN at bottom of card');
console.log('If you still see "Continue With Apple", Xcode did not install this bundle.');
