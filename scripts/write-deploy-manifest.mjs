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

const buildInfo = readFileSync(buildInfoPath, 'utf8');
const buildNumber = buildInfo.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const stamp = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';
const indexPath = resolve(publicDir, 'index.html');
const entry = existsSync(indexPath)
  ? indexPath.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1] ?? 'unknown'
  : 'unknown';

let entryHash = '';
const entryPath = resolve(publicDir, 'assets', entry);
if (existsSync(entryPath)) {
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
