/**
 * Write git commit + build ID into deploy-marker.js and index.html meta.
 * Run before Base44 publish so CDN can prove which source commit is live.
 *
 * Usage: node scripts/sync-source-fingerprint.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '..');

function git(args) {
  return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8' }).trim();
}

const commit = git('rev-parse --short HEAD');
const commitFull = git('rev-parse HEAD');
const branch = git('branch --show-current');

const deployMarkerPath = resolve(repo, 'src/deploy-marker.js');
const deployText = readFileSync(deployMarkerPath, 'utf8');
const deploy = deployText.match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const buildId = `${commit}-v${deploy}-${stamp.replace(/[: ]/g, '')}`;

const markerBody = `// Base44: update these files in the Code editor, then click Publish (GitHub alone is not enough).
export const DEPLOY_BUILD = ${deploy};
export const SOURCE_COMMIT = '${commit}';
export const SOURCE_COMMIT_FULL = '${commitFull}';
export const RB_BUILD_ID = '${buildId}';
`;

writeFileSync(deployMarkerPath, markerBody);

const indexPath = resolve(repo, 'index.html');
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8');
  html = upsertMeta(html, 'restorebraine-source-commit', commit);
  html = upsertMeta(html, 'restorebraine-build-id', buildId);
  html = upsertMeta(html, 'restorebraine-source-branch', branch);
  writeFileSync(indexPath, html);
}

console.log('Source fingerprint synced:');
console.log(`  SOURCE_COMMIT: ${commit} (${branch})`);
console.log(`  RB_BUILD_ID:   ${buildId}`);
console.log('');
console.log('Publish to Base44: index.html + src/deploy-marker.js (included in partial wizard)');
console.log('Verify: node scripts/verify-deployment-trace.mjs');

function upsertMeta(html, name, content) {
  const re = new RegExp(`<meta name="${name}"[^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${content}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(
    /<meta name="restorebraine-deploy"/,
    `${tag}\n    <meta name="restorebraine-deploy"`,
  );
}
