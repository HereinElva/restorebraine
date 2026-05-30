import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const contents = `export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const NATIVE_BUILD_LABEL = 'Native build v11 · 68fdc5f4 · ${stamp}';
`;

writeFileSync(resolve('src/lib/build-info.js'), contents);
console.log(`Wrote build stamp: ${stamp}`);
