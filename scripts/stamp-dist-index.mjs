/**
 * Bakes BUILD_STAMP into dist/index.html and injects v4-native-oauth.js (no duplicate login shell).
 * Login UI lives only in React: src/screens/SignInScreen.jsx — same dist/ syncs to ios/public via cap-merge.
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

if (!html.includes('v4-native-oauth.js')) {
  html = html.replace('</body>', '    <script src="./v4-native-oauth.js"></script>\n  </body>');
}

writeFileSync(distIndex, html);
console.log(`OK: stamped dist/index.html (v${buildNum}) — React-only login, no preboot shell`);

if (html.includes('restorebraine-v4-bridge.js')) {
  console.error('FAIL: index.html must not include sync restorebraine-v4-bridge.js');
  process.exit(1);
}

if (existsSync(distBridge)) {
  let bridge = readFileSync(distBridge, 'utf8');
  bridge = bridge.replace(/BUILD_LABEL_PLACEHOLDER/g, stamp.replace(/'/g, "\\'"));
  writeFileSync(distBridge, bridge);
  console.log(`OK: stamped dist/restorebraine-v4-bridge.js (v${buildNum})`);
}
