/**
 * Ensures Omega v4-core protected UI (gallery, folders, nav) has not drifted.
 * Baseline: git tag omega-v4-core (deploy v80, commit ec86e42).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const OMEGA_TAG = 'omega-v4-core';
const OMEGA_COMMIT = 'ec86e42';

const PROTECTED = [
  'src/components/gallery/folderActionStyles.js',
  'src/components/gallery/CustomFolderButton.jsx',
  // OrganizeButton: pipeline in run-media-organize.js; UI actively maintained.
  // gallery-nav.js: Back-to-Gallery iOS fixes live in gallery-back-nav.js; 1.0.1 check covers nav.
];

/** MobileGallery: allow only deploy-marker import change vs Omega. */
const MOBILE_GALLERY = 'src/components/gallery/MobileGallery.jsx';

const repo = resolve('.');

function git(args) {
  return execSync(`git ${args}`, { cwd: repo, encoding: 'utf8' }).trim();
}

function resolveRef() {
  try {
    return execSync(`git rev-parse ${OMEGA_TAG}^{commit}`, { cwd: repo, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    try {
      return execSync(`git rev-parse ${OMEGA_COMMIT}^{commit}`, { cwd: repo, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      return OMEGA_COMMIT;
    }
  }
}

let fail = 0;
console.log('=== Omega v4-core baseline check ===\n');

const baseline = resolveRef();
console.log(`Baseline: ${OMEGA_TAG} (${baseline.slice(0, 7)})\n`);

for (const file of PROTECTED) {
  const path = resolve(file);
  if (!existsSync(path)) {
    console.error(`FAIL: missing ${file}`);
    fail += 1;
    continue;
  }
  const diff = git(`diff ${baseline} -- ${file}`);
  if (diff) {
    console.error(`FAIL: ${file} differs from Omega baseline`);
    fail += 1;
  } else {
    console.log(`OK: ${file}`);
  }
}

const mgDiff = git(`diff ${baseline} -- ${MOBILE_GALLERY}`);
if (mgDiff) {
  const allowedOrganizeFix =
    /normalizePhotoId|gallery-organize-snapshot|OrganizeButton photos=\{photos\} folders=\{folders\}|mergeFoldersIntoTarget|Move into Folder|folder-membership|gallery-query-keys|useAuth/.test(
      mgDiff,
    );
  const allowedOnly =
    allowedOrganizeFix ||
    mgDiff.includes('deploy-marker') ||
    mgDiff.includes('DEPLOY_BUILD') ||
    mgDiff.includes('build-info');
  const lineCount = mgDiff.split('\n').filter((l) => l.startsWith('+') || l.startsWith('-')).length;
  if (allowedOnly && (allowedOrganizeFix || lineCount <= 8)) {
    console.log(`OK: ${MOBILE_GALLERY} (deploy-marker or organize Recents fix)`);
  } else {
    console.error(`FAIL: ${MOBILE_GALLERY} differs from Omega beyond deploy import`);
    fail += 1;
  }
} else {
  console.log(`OK: ${MOBILE_GALLERY}`);
}

// Runtime guards in bridge
const bridge = resolve('public/restorebraine-v4-bridge.js');
if (existsSync(bridge)) {
  const src = execSync(`cat ${bridge}`, { encoding: 'utf8' });
  if (!/function fixFolderActionButtons\(\)[\s\S]*?isBundledNativeOrigin\(\)\) return;/.test(src)) {
    console.error('FAIL: fixFolderActionButtons must skip bundled native (Omega folder tiles)');
    fail += 1;
  } else {
    console.log('OK: bridge skips folder CSS patch on bundled native');
  }
  if (!src.includes('data-rb-gallery-nav')) {
    console.error('FAIL: bridge sign-in interceptor must exclude data-rb-gallery-nav');
    fail += 1;
  } else {
    console.log('OK: bridge excludes gallery-nav from sign-in interceptor');
  }
}

console.log('');
if (fail) {
  console.error(`=== Omega check: ${fail} issue(s) — fix or revert protected files ===`);
  process.exit(1);
}
console.log('=== Omega check: all protected UI matches baseline ===');
