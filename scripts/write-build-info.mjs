import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const label = `kbrown native v54 · ${stamp}`;

writeFileSync(
  resolve('src/lib/build-info.js'),
  `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const NATIVE_BUILD_LABEL = '${label}';
`
);

writeFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), `${label}\n`);

console.log(`Wrote build stamp: ${label}`);
