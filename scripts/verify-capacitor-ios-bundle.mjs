/**
 * Ensures dist/ and ios/App/App/public/ contain the same web bundle so
 * Xcode's folder reference cannot ship a mismatched index.html + JS pair.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distDir = resolve('dist');
const iosPublicDir = resolve('ios/App/App/public');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const hashFile = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16);

const getIndexScript = (indexPath) => {
  const html = readFileSync(indexPath, 'utf8');
  const match = html.match(/src="\.\/assets\/([^"]+\.js)"/);
  return match?.[1] ?? null;
};

const getDeployVersion = (indexPath) => {
  const html = readFileSync(indexPath, 'utf8');
  const match = html.match(/name="restorebraine-deploy"\s+content="(v\d+)"/);
  return match?.[1] ?? null;
};

if (!existsSync(distDir)) fail('dist/ missing — run vite build first');
if (!existsSync(iosPublicDir)) fail('ios/App/App/public missing — run cap sync ios');

const distIndex = resolve(distDir, 'index.html');
const iosIndex = resolve(iosPublicDir, 'index.html');
if (!existsSync(distIndex) || !existsSync(iosIndex)) {
  fail('index.html missing in dist or ios/App/App/public');
}

const distScript = getIndexScript(distIndex);
const iosScript = getIndexScript(iosIndex);
if (!distScript || !iosScript) {
  fail('Could not find ./assets/*.js script tag in dist or ios index.html');
}
if (distScript !== iosScript) {
  fail(`index.html script mismatch: dist=${distScript} ios=${iosScript} — re-run cap sync`);
}

const distAssets = resolve(distDir, 'assets', distScript);
const iosAssets = resolve(iosPublicDir, 'assets', iosScript);
if (!existsSync(distAssets) || !existsSync(iosAssets)) {
  fail(`Referenced bundle missing: ${distScript}`);
}

const distHash = hashFile(distAssets);
const iosHash = hashFile(iosAssets);
if (distHash !== iosHash) {
  fail(`Bundle hash mismatch for ${distScript}: dist=${distHash} ios=${iosHash}`);
}

const distFiles = new Set(readdirSync(resolve(distDir, 'assets')));
const iosFiles = new Set(readdirSync(resolve(iosPublicDir, 'assets')));
const missingOnIos = [...distFiles].filter((file) => !iosFiles.has(file));
if (missingOnIos.length) {
  fail(`ios/public/assets missing ${missingOnIos.length} file(s) from dist — re-run cap sync`);
}

const deployDist = getDeployVersion(distIndex);
const deployIos = getDeployVersion(iosIndex);
if (deployDist && deployIos && deployDist !== deployIos) {
  fail(`Deploy meta mismatch: dist=${deployDist} ios=${deployIos}`);
}

const stampPath = resolve('ios/App/App/BUILD_STAMP.txt');
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : 'unknown';

console.log(`OK: dist and ios/public match (${distScript}, hash ${distHash})`);
console.log(`OK: deploy tag ${deployIos ?? deployDist ?? 'n/a'}, BUILD_STAMP: ${stamp}`);
