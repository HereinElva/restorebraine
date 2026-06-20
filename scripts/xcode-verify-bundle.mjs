/**
 * Called from Xcode "Restorebraine Verify Bundle" build phase.
 * Same checks as verify-ios-sync index.html → assets, but with clear errors for Xcode.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iosPublic = resolve(repoRoot, 'ios/App/App/public');
const indexPath = resolve(iosPublic, 'index.html');
const assetsDir = resolve(iosPublic, 'assets');
const stampPath = resolve(repoRoot, 'ios/App/App/BUILD_STAMP.txt');

const fail = (message) => {
  console.error(`error: ${message}`);
  console.error('Fix: bash scripts/mac-ios-native-rebuild.sh');
  process.exit(1);
};

const warn = (message) => {
  console.warn(`warning: ${message}`);
};

console.log('Restorebraine iOS bundle check (node)');

if (existsSync(stampPath)) {
  console.log(`BUILD_STAMP: ${readFileSync(stampPath, 'utf8').trim()}`);
} else {
  warn('BUILD_STAMP.txt missing — run bash scripts/mac-ios-native-rebuild.sh');
}

if (!existsSync(indexPath)) {
  fail('ios/App/App/public/index.html missing');
}

if (!existsSync(assetsDir)) {
  fail('ios/App/App/public/assets missing');
}

const html = readFileSync(indexPath, 'utf8');
const scriptMatch = html.match(/src="\.\/assets\/([^"]+\.js)"/);
if (!scriptMatch) {
  fail('index.html has no src="./assets/*.js" script tag');
}

const scriptName = scriptMatch[1];
const scriptPath = resolve(assetsDir, scriptName);
if (!existsSync(scriptPath)) {
  const available = readdirSync(assetsDir).filter((f) => f.endsWith('.js')).slice(0, 8);
  fail(
    `index.html references ${scriptName} but file is missing. ` +
      `Assets has: ${available.join(', ') || '(empty)'}`,
  );
}

const deployMatch = html.match(/name="restorebraine-deploy"\s+content="(v\d+)"/);
const deploy = deployMatch?.[1] ?? 'unknown';
const appBundle = readdirSync(assetsDir).find((f) => f.startsWith('App-') && f.endsWith('.js'));

console.log(`public/index.html: bundle ${scriptName} OK (deploy ${deploy})`);
if (appBundle) {
  console.log(`App chunk: ${appBundle}`);
}
console.log('=========================================');
