import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const buildInfoPath = resolve('src/lib/build-info.js');
const prev = existsSync(buildInfoPath)
  ? Number(readFileSync(buildInfoPath, 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? 100)
  : 100;
const BUILD_NUMBER = prev + 1;

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const nativeLabel = `kbrown v4-core v${BUILD_NUMBER} · ${stamp}`;
const webLabel = `restorebraine web v${BUILD_NUMBER}`;
const versionCode = BUILD_NUMBER;
const versionName = `1.0.${versionCode}`;

writeFileSync(
  buildInfoPath,
  `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const BUILD_NUMBER = ${BUILD_NUMBER};
export const NATIVE_BUILD_LABEL = '${nativeLabel}';
export const WEB_BUILD_LABEL = '${webLabel}';
`
);

writeFileSync(
  resolve('src/deploy-marker.js'),
  `// Base44: update these files in the Code editor, then click Publish (GitHub alone is not enough).
export const DEPLOY_BUILD = ${BUILD_NUMBER};
`
);

writeFileSync(
  resolve('android/version.properties'),
  `# Play Store version — bumped by scripts/write-build-info.mjs
VERSION_CODE=${versionCode}
VERSION_NAME=${versionName}
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${nativeLabel}\n`);

const pbxPath = resolve('ios/App/App.xcodeproj/project.pbxproj');
if (existsSync(pbxPath)) {
  const pbx = readFileSync(pbxPath, 'utf8');
  const updatedPbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${BUILD_NUMBER};`);
  if (updatedPbx !== pbx) {
    writeFileSync(pbxPath, updatedPbx);
    console.log(`Synced Xcode CURRENT_PROJECT_VERSION → ${BUILD_NUMBER}`);
  }
}

const indexHtmlPath = resolve('index.html');
if (existsSync(indexHtmlPath)) {
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');
  writeFileSync(
    indexHtmlPath,
    indexHtml.replace(/content="v\d+"/, `content="v${BUILD_NUMBER}"`)
  );
}

console.log(`Wrote build stamp: ${nativeLabel}`);
console.log(`Web build label: ${webLabel}`);
console.log(`Wrote Android version: ${versionName} (${versionCode})`);
console.log('Run: node scripts/print-base44-publish-hint.mjs');
