/**
 * Writes deploy-manifest.json into dist + ios public so the app can prove which bundle loaded.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const publicDir = resolve('ios/App/App/public');
const distDir = resolve('dist');
const buildInfoPath = resolve('src/lib/build-info.js');
const stampPath = resolve('ios/App/App/BUILD_STAMP.txt');

const readEntryFromIndex = (indexHtmlPath) => {
  if (!existsSync(indexHtmlPath)) return { entry: 'unknown', entryPath: null };
  const html = readFileSync(indexHtmlPath, 'utf8');
  const entry = html.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1] ?? 'unknown';
  const baseDir = resolve(indexHtmlPath, '..');
  const entryPath = entry !== 'unknown' ? resolve(baseDir, 'assets', entry) : null;
  return { entry, entryPath };
};

const buildInfo = readFileSync(buildInfoPath, 'utf8');
const buildNumber = buildInfo.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';

// Prefer ios public after cap sync; fall back to dist during early pipeline runs.
let { entry, entryPath } = readEntryFromIndex(resolve(publicDir, 'index.html'));
if (entry === 'unknown') {
  ({ entry, entryPath } = readEntryFromIndex(resolve(distDir, 'index.html')));
}

let entryHash = '';
if (entryPath && existsSync(entryPath)) {
  entryHash = createHash('sha256').update(readFileSync(entryPath)).digest('hex').slice(0, 16);
}

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

const manifest = {
  buildNumber: Number(buildNumber) || buildNumber,
  stamp,
  entry,
  entryHash,
  gitCommit,
  writtenAt: new Date().toISOString(),
};

const json = `${JSON.stringify(manifest, null, 2)}\n`;

for (const dir of [distDir, publicDir]) {
  if (!existsSync(dir)) continue;
  writeFileSync(resolve(dir, 'deploy-manifest.json'), json);
}

console.log(`OK: deploy-manifest v${buildNumber} entry=${entry} hash=${entryHash || '?'}`);
