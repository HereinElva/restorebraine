/**
 * Bakes BUILD_STAMP into dist/index.html and dist/restorebraine-v4-bridge.js.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distIndex = resolve('dist/index.html');
const distBridge = resolve('dist/restorebraine-v4-bridge.js');
const stampPath = resolve('ios/App/App/BUILD_STAMP.txt');
const buildInfoPath = resolve('src/lib/build-info.js');

if (!existsSync(distIndex)) {
  console.error('FAIL: dist/index.html missing');
  process.exit(1);
}

const stamp = existsSync(stampPath)
  ? readFileSync(stampPath, 'utf8').trim()
  : 'unknown';
const buildNum = readFileSync(buildInfoPath, 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

let html = readFileSync(distIndex, 'utf8');
html = html.replace(/<meta name="restorebraine-build-stamp"[^>]*>/, '');
html = html.replace(
  /<meta name="restorebraine-deploy"/,
  `<meta name="restorebraine-build-stamp" content="${stamp.replace(/"/g, '')}" />\n    <meta name="restorebraine-deploy"`,
);
writeFileSync(distIndex, html);
console.log(`OK: stamped dist/index.html (v${buildNum})`);

if (existsSync(distBridge)) {
  let bridge = readFileSync(distBridge, 'utf8');
  bridge = bridge.replace(/BUILD_LABEL_PLACEHOLDER/g, stamp.replace(/'/g, "\\'"));
  writeFileSync(distBridge, bridge);
  console.log(`OK: stamped dist/restorebraine-v4-bridge.js (v${buildNum})`);
}
