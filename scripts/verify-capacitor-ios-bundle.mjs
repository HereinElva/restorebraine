/**
 * Verifies dist/ and ios/App/App/public/ are identical (full tree, not just assets/).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const distDir = resolve('dist');
const iosPublicDir = resolve('ios/App/App/public');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const hashFile = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16);

const listFilesRecursive = (dir, base = dir) => {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, base));
    } else if (entry.isFile()) {
      results.push(relative(base, full));
    }
  }
  return results.sort();
};

if (!existsSync(distDir)) fail('dist/ missing — run vite build first');
if (!existsSync(iosPublicDir)) fail('ios/App/App/public missing — run cap:merge-web-into-ios');

const distIndex = resolve(distDir, 'index.html');
const iosIndex = resolve(iosPublicDir, 'index.html');
const distScript = readFileSync(distIndex, 'utf8').match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];
const iosScript = readFileSync(iosIndex, 'utf8').match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];

if (!distScript || !iosScript) fail('Could not find entry JS in dist or ios index.html');
if (distScript !== iosScript) {
  fail(`entry JS mismatch: dist=${distScript} ios=${iosScript} — run npm run cap:merge-web-into-ios`);
}

const distFiles = listFilesRecursive(distDir);
const iosOnlySkip = new Set(['cordova.js', 'cordova_plugins.js']);

for (const rel of distFiles) {
  const distPath = resolve(distDir, rel);
  const iosPath = resolve(iosPublicDir, rel);
  if (!existsSync(iosPath)) fail(`ios/public missing ${rel} — run cap:merge-web-into-ios`);
  if (hashFile(distPath) !== hashFile(iosPath)) {
    fail(`hash mismatch for ${rel} — run cap:merge-web-into-ios`);
  }
}

const iosFiles = listFilesRecursive(iosPublicDir).filter((f) => !iosOnlySkip.has(f));
const orphans = iosFiles.filter((f) => !distFiles.includes(f));
if (orphans.length) {
  fail(`ios/public stale orphan(s): ${orphans.slice(0, 5).join(', ')} — run cap:merge-web-into-ios`);
}

const stampPath = resolve('ios/App/App/BUILD_STAMP.txt');
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : 'unknown';

console.log(`OK: dist ↔ ios/public identical (${distFiles.length} files, entry ${distScript})`);
console.log(`OK: BUILD_STAMP: ${stamp}`);
