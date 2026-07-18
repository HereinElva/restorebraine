import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILD_NUMBER = 87;
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
  `// Base44: update these files in the Code editor, then click Publish (GitHub alone is not enough).
export const DEPLOY_BUILD = ${BUILD_NUMBER};
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${nativeLabel}\n`);

const indexHtmlPath = resolve('index.html');
const indexHtml = readFileSync(indexHtmlPath, 'utf8');
writeFileSync(
  indexHtmlPath,
  indexHtml.replace(/content="v\d+"/, `content="v${BUILD_NUMBER}"`)
);

console.log(`Wrote build stamp: ${nativeLabel}`);
console.log(`Web build label: ${webLabel}`);
console.log('Run: node scripts/print-base44-publish-hint.mjs');
