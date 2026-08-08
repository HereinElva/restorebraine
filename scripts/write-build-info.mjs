import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const versionCode = 34;
const versionName = `1.0.${versionCode}`;
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const label = `kbrown native v${versionCode} · ${stamp}`;

writeFileSync(
  resolve('src/lib/build-info.js'),
  `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const NATIVE_BUILD_LABEL = '${label}';
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${label}\n`);

writeFileSync(
  resolve('android/version.properties'),
  `# Play Store version — bumped by scripts/write-build-info.mjs
VERSION_CODE=${versionCode}
VERSION_NAME=${versionName}
`
);

console.log(`Wrote build stamp: ${label}`);
console.log(`Wrote Android version: ${versionName} (${versionCode})`);
