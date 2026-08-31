/**
 * Align native + web build numbers to DEPLOY_BUILD (no increment).
 * Run before iOS/Android builds to prevent ghost version drift.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const deployMarkerPath = resolve('src/deploy-marker.js');
if (!existsSync(deployMarkerPath)) {
  console.error('Missing src/deploy-marker.js');
  process.exit(1);
}

const deployText = readFileSync(deployMarkerPath, 'utf8');
const target = Number(deployText.match(/DEPLOY_BUILD = (\d+)/)?.[1]);
if (!Number.isFinite(target) || target < 1) {
  console.error('Could not read DEPLOY_BUILD from deploy-marker.js');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const nativeLabel = `kbrown v4-core v${target} · ${stamp}`;
const webLabel = `restorebraine web v${target}`;

writeFileSync(
  resolve('src/lib/build-info.js'),
  `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const BUILD_NUMBER = ${target};
export const NATIVE_BUILD_LABEL = '${nativeLabel}';
export const WEB_BUILD_LABEL = '${webLabel}';
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${nativeLabel}\n`);

const pbxPath = resolve('ios/App/App.xcodeproj/project.pbxproj');
if (existsSync(pbxPath)) {
  const pbx = readFileSync(pbxPath, 'utf8');
  const updated = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${target};`);
  if (updated !== pbx) writeFileSync(pbxPath, updated);
}

const indexHtmlPath = resolve('index.html');
if (existsSync(indexHtmlPath)) {
  const html = readFileSync(indexHtmlPath, 'utf8');
  writeFileSync(indexHtmlPath, html.replace(/content="v\d+"/, `content="v${target}"`));
}

const androidVersionPath = resolve('android/version.properties');
if (existsSync(androidVersionPath)) {
  writeFileSync(
    androidVersionPath,
    `# Play Store version — synced by scripts/sync-build-numbers.mjs
VERSION_CODE=${target}
VERSION_NAME=1.0.${target}
`
  );
}

console.log(`Synced all build numbers → v${target}`);
console.log(`  build-info.js BUILD_NUMBER = ${target}`);
console.log(`  deploy-marker.js DEPLOY_BUILD = ${target} (unchanged)`);
console.log(`  index.html meta = v${target}`);
console.log(`  Xcode CURRENT_PROJECT_VERSION = ${target}`);
console.log(`  BUILD_STAMP.txt = ${nativeLabel}`);
