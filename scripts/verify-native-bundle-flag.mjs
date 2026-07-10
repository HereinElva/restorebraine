/**
 * Fails the build if native-local was requested but the Vite bundle still has
 * LOCAL_NATIVE_BUNDLE=false (causes immediate redirect to restorebraine.base44.app).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const modeFile = resolve('src/lib/native-bundle-mode.js');
const modeSrc = readFileSync(modeFile, 'utf8');

if (!/LOCAL_NATIVE_BUNDLE = true/.test(modeSrc)) {
  console.error('FAIL: src/lib/native-bundle-mode.js must be true before vite build for native-local');
  process.exit(1);
}

const assetsDir = resolve('dist/assets');
const distIndex = resolve('dist/index.html');
const entryMatch = existsSync(distIndex)
  ? readFileSync(distIndex, 'utf8').match(/src="\.\/assets\/([^"]+\.js)"/)
  : null;
const entryBundle = entryMatch?.[1] ?? null;

const checkBundle = (file, label) => {
  const content = readFileSync(resolve(assetsDir, file), 'utf8');
  if (/LOCAL_NATIVE_BUNDLE=!1|LOCAL_NATIVE_BUNDLE=false/.test(content)) {
    console.error(`FAIL: ${label} ${file} contains LOCAL_NATIVE_BUNDLE=false — app will redirect to Base44 URL`);
    console.error('Fix: run use-local-native-bundle.mjs --local BEFORE vite build');
    process.exit(1);
  }
  console.log(`OK: ${label} ${file} has LOCAL_NATIVE_BUNDLE=true baked in`);
};

const appBundle = readdirSync(assetsDir).find((f) => f.startsWith('App-') && f.endsWith('.js'));
const bundlesToCheck = [];

if (appBundle) {
  bundlesToCheck.push(['App chunk', appBundle]);
}

if (entryBundle && entryBundle !== appBundle) {
  if (!existsSync(resolve(assetsDir, entryBundle))) {
    console.error(`FAIL: index.html references missing entry ${entryBundle}`);
    process.exit(1);
  }
  bundlesToCheck.push(['Entry chunk', entryBundle]);
} else if (!appBundle && entryBundle) {
  bundlesToCheck.push(['Entry chunk', entryBundle]);
}

if (bundlesToCheck.length === 0) {
  console.error('FAIL: no entry or App chunk in dist/assets');
  process.exit(1);
}

for (const [label, file] of bundlesToCheck) {
  checkBundle(file, label);
}
