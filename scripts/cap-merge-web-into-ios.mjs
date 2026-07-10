/**
 * Merge the Vite web app (dist/) into the iOS Capacitor bundle (ios/App/App/public/).
 *
 * Capacitor sync alone is not enough — it can leave stale files and Xcode may ship
 * an old ios/public folder. This script:
 *   1. Runs cap sync ios (native plugin wiring)
 *   2. Force-mirrors dist/ → ios/App/App/public/ (1:1 with built web app)
 *   3. Verifies every dist file exists in ios/public with matching hash
 *
 * Usage: node scripts/cap-merge-web-into-ios.mjs
 *        SKIP_CAP_SYNC=1 node scripts/cap-merge-web-into-ios.mjs  (mirror only)
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const distDir = resolve(repo, 'dist');
const iosPublicDir = resolve(repo, 'ios/App/App/public');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const ok = (message) => console.log(`OK: ${message}`);

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

if (!existsSync(distDir)) {
  fail('dist/ missing — run: npm run build:native-local (or vite build first)');
}

if (!existsSync(resolve(distDir, 'index.html'))) {
  fail('dist/index.html missing — web app did not build');
}

const entryMatch = readFileSync(resolve(distDir, 'index.html'), 'utf8').match(
  /src="\.\/assets\/([^"]+\.js)"/,
);
const entryJs = entryMatch?.[1];
if (!entryJs || !existsSync(resolve(distDir, 'assets', entryJs))) {
  fail(`dist entry JS missing: ${entryJs ?? 'unknown'}`);
}

// Step 1: cap sync (updates native iOS project + initial copy of dist)
if (process.env.SKIP_CAP_SYNC !== '1') {
  if (existsSync(iosPublicDir)) {
    const count = listFilesRecursive(iosPublicDir).length;
    console.log(`Removing ios/App/App/public (${count} files) before cap sync...`);
    rmSync(iosPublicDir, { recursive: true, force: true });
  }
  console.log('Running npx cap sync ios...');
  execSync('npx cap sync ios', { cwd: repo, stdio: 'inherit' });
  execSync('node scripts/register-local-ios-plugins.mjs', { cwd: repo, stdio: 'inherit' });
} else {
  console.log('SKIP_CAP_SYNC=1 — mirror dist only');
}

// Step 2: force mirror dist → ios/public (guarantees web app = native bundle)
console.log('Force-mirroring dist/ → ios/App/App/public/ ...');
rmSync(iosPublicDir, { recursive: true, force: true });
mkdirSync(iosPublicDir, { recursive: true });
cpSync(distDir, iosPublicDir, { recursive: true });

// Capacitor expects these placeholders in public/
for (const placeholder of ['cordova.js', 'cordova_plugins.js']) {
  writeFileSync(resolve(iosPublicDir, placeholder), '');
}

// Step 3: verify every dist file is in ios/public with same hash
const distFiles = listFilesRecursive(distDir);
const mismatches = [];
const missing = [];

for (const rel of distFiles) {
  const distPath = resolve(distDir, rel);
  const iosPath = resolve(iosPublicDir, rel);
  if (!existsSync(iosPath)) {
    missing.push(rel);
    continue;
  }
  const distHash = hashFile(distPath);
  const iosHash = hashFile(iosPath);
  if (distHash !== iosHash) {
    mismatches.push({ rel, distHash, iosHash });
  }
}

if (missing.length) {
  fail(`ios/public missing ${missing.length} file(s) from dist: ${missing.slice(0, 5).join(', ')}`);
}
if (mismatches.length) {
  fail(
    `hash mismatch after mirror: ${mismatches
      .slice(0, 3)
      .map((m) => `${m.rel} dist=${m.distHash} ios=${m.iosHash}`)
      .join('; ')}`,
  );
}

const iosFiles = listFilesRecursive(iosPublicDir).filter(
  (f) => f !== 'cordova.js' && f !== 'cordova_plugins.js',
);
const orphans = iosFiles.filter((f) => !distFiles.includes(f));
if (orphans.length) {
  fail(`ios/public has ${orphans.length} orphan(s) not in dist: ${orphans.slice(0, 5).join(', ')}`);
}

const stampPath = resolve(repo, 'ios/App/App/BUILD_STAMP.txt');
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : 'unknown';
const buildInfo = readFileSync(resolve(repo, 'src/lib/build-info.js'), 'utf8');
const buildNum = buildInfo.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

ok(`Web app merged into iOS: ${distFiles.length} files, entry ${entryJs}`);
ok(`BUILD_STAMP: ${stamp}`);
ok(`BUILD_NUMBER: v${buildNum}`);
console.log('');
console.log('Next: Xcode Run to device (or bash scripts/mac-ios-v4-install.sh)');
console.log('  Build log MUST show: Restorebraine DEPLOY OK');
