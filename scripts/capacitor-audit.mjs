import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const read = (relPath) => readFileSync(resolve(root, relPath), 'utf8');

const checks = [
  {
    layer: '1 · Web bootstrap',
    name: 'main.jsx bootstraps session before React',
    ok: () => {
      const main = read('src/main.jsx');
      return main.includes('restoreSessionFromNativeStorage') && main.includes('installNativeOAuthFix');
    },
  },
  {
    layer: '1 · Web bootstrap',
    name: 'OAuth token capture from URL',
    ok: () => read('src/lib/native-oauth-fix.js').includes('captureAccessTokenFromUrl'),
  },
  {
    layer: '1 · Web bootstrap',
    name: 'Centralized Google login URL (not moderator)',
    ok: () => {
      const auth = read('src/lib/auth-urls.js');
      const params = read('src/lib/app-params.js');
      return auth.includes('BASE44_APP_ID') && auth.includes("prompt: 'select_account'")
        && params.includes('68fdc5f42768c4d045fe1bac');
    },
  },
  {
    layer: '1 · Web bootstrap',
    name: 'Sandbox iframe messaging disabled on native',
    ok: () => read('src/App.jsx').includes('isNativeShell'),
  },
  {
    layer: '2 · Capacitor config',
    name: 'server.url points at hosted Restorebraine app',
    ok: () => read('capacitor.config.json').includes('https://restorebraine.base44.app'),
  },
  {
    layer: '2 · Capacitor config',
    name: 'Google OAuth domains in allowNavigation',
    ok: () => read('capacitor.config.json').includes('*.google.com'),
  },
  {
    layer: '2 · Capacitor config',
    name: 'iOS synced capacitor.config.json',
    ok: () => existsSync('ios/App/App/capacitor.config.json'),
  },
  {
    layer: '3 · Native bridge',
    name: 'AppDelegate session bridge + OAuth popup fix',
    ok: () => {
      const delegate = read('ios/App/App/AppDelegate.swift');
      return delegate.includes('__restorebraineOAuthFixInstalled') && delegate.includes('persistToken');
    },
  },
  {
    layer: '3 · Native bridge',
    name: 'Info.plist URL scheme for deep links',
    ok: () => read('ios/App/App/Info.plist').includes('restorebraine'),
  },
  {
    layer: '3 · Native bridge',
    name: 'Capacitor App + Preferences plugins installed',
    ok: () => {
      const pkg = read('package.json');
      return pkg.includes('@capacitor/app') && pkg.includes('@capacitor/preferences');
    },
  },
  {
    layer: '4 · Bundled assets',
    name: 'iOS public bundle synced',
    ok: () => existsSync('ios/App/App/public/index.html'),
  },
  {
    layer: '4 · Bundled assets',
    name: 'BUILD_STAMP.txt present',
    ok: () => existsSync('ios/App/App/BUILD_STAMP.txt'),
  },
  {
    layer: '4 · Bundled assets',
    name: 'OAuth fix in bundled index.html',
    ok: () => read('ios/App/App/public/index.html').includes('__restorebraineOAuthFixInstalled'),
  },
  {
    layer: '4 · Bundled assets',
    name: 'npm build runs cap sync ios',
    ok: () => read('package.json').includes('npx cap sync ios'),
  },
];

let failed = 0;
const byLayer = {};

for (const check of checks) {
  byLayer[check.layer] ??= [];
  try {
    const pass = check.ok();
    byLayer[check.layer].push({ name: check.name, pass });
    if (!pass) failed += 1;
  } catch (error) {
    byLayer[check.layer].push({ name: check.name, pass: false, error: error.message });
    failed += 1;
  }
}

console.log('\nRestorebraine Capacitor 4-layer audit\n');

for (const [layer, items] of Object.entries(byLayer)) {
  console.log(layer);
  for (const item of items) {
    const mark = item.pass ? 'OK  ' : 'FAIL';
    console.log(`  [${mark}] ${item.name}${item.error ? ` (${item.error})` : ''}`);
  }
  console.log('');
}

if (failed > 0) {
  console.error(`${failed} check(s) failed. Run: npm run ios:prepare`);
  process.exit(1);
}

const stamp = existsSync('ios/App/App/BUILD_STAMP.txt')
  ? readFileSync(resolve(root, 'ios/App/App/BUILD_STAMP.txt'), 'utf8').trim()
  : 'unknown';
console.log(`All 4 layers OK — kbrown9000 native flow ready (${stamp})\n`);
