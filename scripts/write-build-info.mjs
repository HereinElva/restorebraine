import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILD_NUMBER = 68;
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const nativeLabel = `kbrown native v${BUILD_NUMBER} · ${stamp}`;
const webLabel = `restorebraine web v${BUILD_NUMBER}`;

writeFileSync(
  resolve('src/lib/build-info.js'),
  `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const BUILD_NUMBER = ${BUILD_NUMBER};
export const NATIVE_BUILD_LABEL = '${nativeLabel}';
export const WEB_BUILD_LABEL = '${webLabel}';
`
);

writeFileSync(
  resolve('src/deploy-marker.js'),
  `// Single source for the live build label shown in the app UI.
// Base44 deploy: paste this file + Layout.jsx, then Publish.
export const DEPLOY_BUILD = ${BUILD_NUMBER};
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${nativeLabel}\n`);

console.log(`Wrote build stamp: ${nativeLabel}`);
console.log(`Web build label: ${webLabel}`);
