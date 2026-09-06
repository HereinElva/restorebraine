/**
 * Horizontal deployment trace: SOURCE → CDN → Capacitor config.
 * Does NOT assume Base44 Publish succeeded — proves artifacts with hashes and markers.
 *
 * Usage: node scripts/verify-deployment-trace.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  parseDeployFromHtml,
  parseSourceCommitFromHtml,
  parseBuildIdFromHtml,
  metaContent,
} from './lib/parse-deploy-meta.mjs';

const LIVE = 'https://restorebraine.base44.app';
const APP_ID = '68fdc5f42768c4d045fe1bac';
const CANONICAL = 'cursor/fix-folder-persistence-bacf';

/** @type {{ layer: string, check: string, status: 'PASS'|'FAIL'|'WARN'|'SKIP'|'INFO', detail: string }[]} */
const rows = [];

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: resolve(import.meta.dirname, '..'), encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function read(rel) {
  const p = resolve(import.meta.dirname, '..', rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function curl(url, { head = false } = {}) {
  try {
    const flag = head ? '-sI' : '-sL';
    return execSync(`curl ${flag} --max-time 25 '${url}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function record(layer, check, status, detail) {
  rows.push({ layer, check, status, detail });
}

function headValue(headers, name) {
  const m = headers.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
  return m?.[1]?.trim() ?? '';
}

const headCommit = git('rev-parse --short HEAD');
const headFull = git('rev-parse HEAD');
const branch = git('branch --show-current');

console.log('══════════════════════════════════════════════════════════════');
console.log('  RESTOREBRAINE DEPLOYMENT TRACE — source → CDN → Capacitor');
console.log('══════════════════════════════════════════════════════════════\n');

// ── LAYER 1: SOURCE ─────────────────────────────────────────────────────────
console.log('LAYER 1 — SOURCE (GitHub / local repo)\n');

record('SOURCE', 'HEAD commit', headCommit ? 'PASS' : 'FAIL', headCommit || 'not a git repo');
record('SOURCE', 'Branch', branch === CANONICAL ? 'PASS' : 'WARN', branch);

const fixCommits = [
  { id: 'stripe-intercept', sha: '169b62c', label: 'return openInApp(u) in index.html' },
  { id: 'hosted-guard', sha: '1fe82b9', label: 'rbHostedRuntimeGuard overlay' },
  { id: 'folder-sync', sha: '7e3ffc6', label: 'folder-server-sync / claimOrphanedData' },
  { id: 'runtime-diag', sha: '169b62c', label: 'RuntimeDiagnostic component' },
  { id: 'apple-login', sha: '1a34fb6', label: 'Apple login hosted publish path (v273)' },
  { id: 'google-oauth', sha: '4c49021', label: 'Fix stuck Opening Google OAuth' },
];

for (const fix of fixCommits) {
  let status = 'FAIL';
  try {
    execSync(`git merge-base --is-ancestor ${fix.sha} HEAD`, {
      cwd: resolve(import.meta.dirname, '..'),
      stdio: 'pipe',
    });
    status = 'PASS';
  } catch {
    status = 'FAIL';
  }
  record('SOURCE', `Fix ancestor ${fix.id}`, status, `${fix.sha} ${fix.label}`);
}

const gitIndex = read('index.html');
const gitGuard = read('public/hosted-runtime-guard.js');
const gitDeployMarker = read('src/deploy-marker.js');
const gitAccount = read('src/pages/Account.jsx');
const gitRuntimeDiag = read('src/components/RuntimeDiagnostic.jsx');

const sourceCommit = gitDeployMarker.match(/SOURCE_COMMIT = '([^']+)'/)?.[1] ?? '(not set — run sync-source-fingerprint.mjs)';
const rbBuildId = gitDeployMarker.match(/RB_BUILD_ID = '([^']+)'/)?.[1] ?? '(not set)';

const fingerprintStale = !sourceCommit.startsWith('(') && sourceCommit !== headCommit;

record(
  'SOURCE',
  'SOURCE_COMMIT in deploy-marker',
  sourceCommit.startsWith('(') ? 'WARN' : fingerprintStale ? 'WARN' : 'PASS',
  fingerprintStale
    ? `stamped=${sourceCommit} HEAD=${headCommit} — run sync-source-fingerprint.mjs`
    : sourceCommit,
);
record('SOURCE', 'RB_BUILD_ID in deploy-marker', rbBuildId.startsWith('(') ? 'WARN' : 'PASS', rbBuildId);

const gitFingerprints = {
  'index.html stripe': gitIndex.includes('return openInApp(u);}var a=Location') ? sha256('return openInApp(u)') : 'MISSING',
  'hosted-runtime-guard': gitGuard.includes('rbHostedRuntimeGuard') ? sha256(gitGuard) : 'MISSING',
  'Account.jsx RuntimeDiagnostic': gitAccount.includes('RuntimeDiagnostic') ? sha256('RuntimeDiagnostic') : 'MISSING',
};

for (const [k, v] of Object.entries(gitFingerprints)) {
  record('SOURCE', `Git ${k}`, v === 'MISSING' ? 'FAIL' : 'PASS', v);
}

console.log(`  HEAD:           ${headCommit} (${branch})`);
console.log(`  SOURCE_COMMIT:  ${sourceCommit}`);
console.log(`  RB_BUILD_ID:    ${rbBuildId}`);
for (const fix of fixCommits) {
  const row = rows.find((r) => r.check === `Fix ancestor ${fix.id}`);
  console.log(`  ${row?.status === 'PASS' ? 'OK' : 'FAIL'}  fix ${fix.id} ← ${fix.sha}`);
}

// Recent commits: diagnostic tooling vs application source
const sinceFolder = '7e3ffc6';
const diagOnly = git(`log --oneline ${sinceFolder}..HEAD -- scripts/ docs/ package.json`).split('\n').filter(Boolean);
const appOnly = git(`log --oneline ${sinceFolder}..HEAD -- src/ index.html public/`).split('\n').filter(Boolean);
record(
  'SOURCE',
  'Commits since folder fix (diagnostic)',
  'INFO',
  `${diagOnly.length} commits touching scripts/docs/package.json`,
);
record(
  'SOURCE',
  'Commits since folder fix (app source)',
  appOnly.length ? 'PASS' : 'WARN',
  appOnly.length ? `${appOnly.length} commits touching src/index/public` : 'none — recent work is audit tooling only',
);
console.log('');
console.log(`  Since ${sinceFolder} (folder fix):`);
console.log(`    diagnostic commits: ${diagOnly.length} (scripts/docs/package.json)`);
console.log(`    app source commits: ${appOnly.length} (src/index.html/public/)`);
if (diagOnly.length && !appOnly.length) {
  console.log('    NOTE: Recent git pulls may be tooling-only — app fixes are in earlier commits');
}
console.log('');

// ── LAYER 2: BASE44 EDITOR ──────────────────────────────────────────────────
console.log('LAYER 2 — BASE44 EDITOR (cannot read remotely)\n');
record(
  'BASE44 EDITOR',
  'Remote editor state',
  'SKIP',
  'Base44 has independent project state — not Git-linked. Manual paste only.',
);
record(
  'BASE44 EDITOR',
  'App identity',
  'INFO',
  `Must be Restorebraine app_id=${APP_ID}`,
);
console.log('  SKIP: Cannot curl Base44 editor — verify manually in dashboard');
console.log(`  MUST: App ID ${APP_ID}, project name Restorebraine`);
console.log('  After paste: index.html SOURCE_COMMIT meta must match git HEAD');
console.log('');

// ── LAYER 3 & 4: CDN (build artifact + deployment) ──────────────────────────
console.log('LAYER 3/4 — BASE44 BUILD ARTIFACT + CDN\n');

const liveHtml = curl(`${LIVE}/?nocache=${Date.now()}`);
const liveHeaders = curl(`${LIVE}/`, { head: true });
const liveBundleName = liveHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const liveCss = liveHtml.match(/assets\/(index-[^"]+\.css)/)?.[1] ?? '?';
const liveBundle = liveBundleName !== '?' ? curl(`${LIVE}/assets/${liveBundleName}`) : '';
const liveGuard = curl(`${LIVE}/hosted-runtime-guard.js`);
const liveGuardHeaders = curl(`${LIVE}/hosted-runtime-guard.js`, { head: true });
const liveScrub = curl(`${LIVE}/native-ui-scrub.js`);

const liveSourceCommit = parseSourceCommitFromHtml(liveHtml);
const liveBuildId = parseBuildIdFromHtml(liveHtml);
const liveDeployRaw = metaContent(liveHtml, 'restorebraine-deploy');
const liveDeployNum = parseDeployFromHtml(liveHtml);
const cdnCommitMatch =
  !!liveSourceCommit &&
  (liveSourceCommit === headCommit ||
    headCommit.startsWith(liveSourceCommit) ||
    liveSourceCommit.startsWith(headCommit));

record('CDN', 'Live HTML fetch', liveHtml.length > 500 ? 'PASS' : 'FAIL', LIVE);
record('CDN', 'Module bundle ref', liveBundleName !== '?' ? 'PASS' : 'FAIL', liveBundleName);
record('CDN', 'Bundle body fetch', liveBundle.length > 1000 ? 'PASS' : 'FAIL', `${liveBundle.length} bytes`);
record('CDN', 'Bundle sha256 (16)', liveBundle ? 'INFO' : 'FAIL', liveBundle ? sha256(liveBundle) : '?');
record('CDN', 'Guard sha256 (16)', liveGuard ? 'INFO' : 'FAIL', liveGuard ? sha256(liveGuard) : '?');

const stripeOk = liveHtml.includes('return openInApp(u);}var a=Location');
const stripeBroken = liveHtml.includes('openInApp(u);return true;}var a=Location');
record('CDN', 'Stripe intercept in live HTML', stripeOk ? 'PASS' : stripeBroken ? 'FAIL' : 'WARN', stripeOk ? 'return openInApp(u)' : 'broken/missing');

const guardOk = liveGuard.includes('rbHostedRuntimeGuard');
record('CDN', 'hosted-runtime-guard on CDN', guardOk ? 'PASS' : 'FAIL', `${liveGuard.length} bytes`);

const bundleMarkers = {
  claimOrphanedData: liveBundle.includes('claimOrphanedData'),
  'data-rb-payment-modal': liveBundle.includes('data-rb-payment-modal'),
  openInWebView: liveBundle.includes('openInWebView'),
  'Runtime diagnostic': liveBundle.includes('Runtime diagnostic'),
  __restorebraineFolderClaimStatus: liveBundle.includes('__restorebraineFolderClaimStatus'),
};

for (const [marker, ok] of Object.entries(bundleMarkers)) {
  record('CDN', `Bundle marker: ${marker}`, ok ? 'PASS' : 'WARN', ok ? 'present' : 'absent in JS bundle');
}

if (liveSourceCommit) {
  record(
    'CDN',
    'SOURCE_COMMIT meta on CDN',
    cdnCommitMatch ? 'PASS' : 'FAIL',
    `live=${liveSourceCommit} git=${headCommit}`,
  );
} else {
  record(
    'CDN',
    'SOURCE_COMMIT meta on CDN',
    'FAIL',
    'missing — sync fingerprint → partial publish wizard → Publish index.html',
  );
}

if (liveBuildId) {
  record('CDN', 'RB_BUILD_ID meta on CDN', liveBuildId === rbBuildId ? 'PASS' : 'WARN', liveBuildId);
} else {
  record('CDN', 'RB_BUILD_ID meta on CDN', 'WARN', 'missing — publish index.html after sync-source-fingerprint');
}

const cacheControl = headValue(liveHeaders, 'cache-control') || headValue(liveHeaders, 'Cache-Control');
const guardCache = headValue(liveGuardHeaders, 'cache-control') || headValue(liveGuardHeaders, 'Cache-Control');
const lastModified = headValue(liveHeaders, 'last-modified') || headValue(liveHeaders, 'Last-Modified');
const etag = headValue(liveHeaders, 'etag') || headValue(liveHeaders, 'ETag');
record('CDN', 'HTML cache-control', 'INFO', cacheControl || 'unknown');
record('CDN', 'Guard cache-control', 'INFO', guardCache || 'unknown');
record('CDN', 'HTML Last-Modified', 'INFO', lastModified || 'unknown');
record('CDN', 'HTML ETag', 'INFO', etag || 'unknown');

const gitIndexHash = sha256(gitIndex);
const liveIndexHash = sha256(liveHtml);
record(
  'CDN',
  'index.html body hash vs git',
  gitIndexHash === liveIndexHash ? 'PASS' : 'WARN',
  `git=${gitIndexHash} live=${liveIndexHash}`,
);

console.log(`  HTML → bundle:  ${liveBundleName}`);
console.log(`  HTML → css:     ${liveCss}`);
console.log(`  bundle sha256:  ${liveBundle ? sha256(liveBundle) : '?'}`);
console.log(`  guard sha256:   ${liveGuard ? sha256(liveGuard) : '?'} (${liveGuard.length}b)`);
console.log(`  Stripe HTML:    ${stripeOk ? 'OK return openInApp(u)' : stripeBroken ? 'BROKEN' : '?'}`);
console.log(`  CDN SOURCE_COMMIT: ${liveSourceCommit ?? 'MISSING'}`);
console.log(`  CDN deploy meta:   ${liveDeployRaw ?? 'MISSING'} (v${liveDeployNum})`);
console.log(`  CDN RB_BUILD_ID:   ${liveBuildId ?? 'MISSING'}`);
console.log(`  Cache-Control:     ${cacheControl || '?'}`);
console.log(`  Last-Modified:     ${lastModified || '?'}`);
console.log(`  index.html hash:   git=${gitIndexHash} live=${liveIndexHash}`);
console.log('');

// ── WHY SAME BUNDLE HASH? ───────────────────────────────────────────────────
console.log('WHY index-DH2_Ello.js MAY BE UNCHANGED (7 hypotheses)\n');

const distBundle = read('dist/index.html').match(/assets\/(index-[^"]+\.js)/)?.[1];
const hypotheses = [
  {
    id: 1,
    label: 'Only index.html/public changed (no JS rebuild on Base44)',
    likely: stripeOk && guardOk && !bundleMarkers['Runtime diagnostic'],
  },
  {
    id: 2,
    label: 'Base44 build failed silently',
    likely: !stripeOk && !guardOk,
  },
  {
    id: 3,
    label: 'Wrong Base44 project deployed',
    likely: false,
  },
  {
    id: 4,
    label: 'CDN serving old deployment',
    likely: stripeBroken && gitIndex.includes('return openInApp'),
  },
  {
    id: 5,
    label: 'Browser/WebView cache',
    likely: stripeOk && guardOk,
  },
  {
    id: 6,
    label: 'HTML points to old bundle (stale index.html)',
    likely: stripeBroken,
  },
  {
    id: 7,
    label: 'Base44 build not consuming pasted files',
    likely: !liveSourceCommit && sourceCommit !== '(not set — run sync-source-fingerprint.mjs)',
  },
];

for (const h of hypotheses) {
  const tag = h.likely ? 'LIKELY' : 'unlikely';
  console.log(`  [${h.id}] ${h.label} — ${tag}`);
  record('ANALYSIS', `Hypothesis ${h.id}`, h.likely ? 'WARN' : 'INFO', h.label);
}
console.log('');
console.log(`  Note: local dist bundle ${distBundle ?? 'n/a'} ≠ live ${liveBundleName} is EXPECTED`);
console.log('  (Base44 builds on their servers, not from your Mac dist/)');
console.log('');

// ── LAYER 5: CAPACITOR (repo config — runtime URL on device not curl-verifiable) ─
console.log('LAYER 5 — CAPACITOR SHELL (repo config)\n');

const capIos = read('ios/App/App/capacitor.config.json');
const serverUrl = capIos.match(/"url"\s*:\s*"([^"]+)"/)?.[1] ?? '';
const hosted = serverUrl.includes('restorebraine.base44.app');
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim().replace(/\s+/g, ' ');

record('CAPACITOR', 'server.url hosted', hosted ? 'PASS' : 'FAIL', serverUrl);
record('CAPACITOR', 'rb_native cache bust', /rb_native=v\d+/.test(serverUrl) ? 'PASS' : 'WARN', serverUrl);
record('CAPACITOR', 'BUILD_STAMP.txt', stamp ? 'PASS' : 'WARN', stamp);
record(
  'CAPACITOR',
  'Runtime URL on iPhone',
  'SKIP',
  'Prove on device: purple overlay shell restorebraine.base44.app OR Account Runtime diagnostic origin',
);

console.log(`  server.url:    ${serverUrl}`);
console.log(`  BUILD_STAMP:   ${stamp}`);
console.log('  iPhone runtime URL: NOT curl-verifiable — check overlay on device');
console.log('');

// ── SUMMARY TABLE ───────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');
console.log('  TRACE SUMMARY');
console.log('══════════════════════════════════════════════════════════════\n');

const layers = ['SOURCE', 'BASE44 EDITOR', 'CDN', 'CAPACITOR', 'ANALYSIS'];
for (const layer of layers) {
  const layerRows = rows.filter((r) => r.layer === layer && r.status !== 'INFO');
  if (!layerRows.length) continue;
  const fails = layerRows.filter((r) => r.status === 'FAIL').length;
  const warns = layerRows.filter((r) => r.status === 'WARN').length;
  const passes = layerRows.filter((r) => r.status === 'PASS').length;
  const overall =
    fails > 0 ? 'FAIL' : warns > 0 ? 'WARN' : passes > 0 ? 'PASS' : 'SKIP';
  console.log(`  ${layer.padEnd(16)} ${overall}  (pass=${passes} warn=${warns} fail=${fails})`);
}

console.log('');
const blockers = rows.filter((r) => r.status === 'FAIL');
if (blockers.length) {
  console.log('BLOCKERS:');
  blockers.forEach((r) => console.log(`  • [${r.layer}] ${r.check}: ${r.detail}`));
  console.log('');
}

const keyPass =
  stripeOk &&
  guardOk &&
  bundleMarkers.claimOrphanedData &&
  hosted &&
  !blockers.some((b) => b.layer === 'SOURCE');

if (cdnCommitMatch) {
  console.log('DEPLOYMENT VERIFIED — CDN fingerprint matches git HEAD');
  if (fingerprintStale) {
    console.log('LOCAL STAMP STALE — run: npm run sync:source-fingerprint (optional, CDN already correct)');
  }
} else if (stripeOk && guardOk) {
  console.log('CDN CONTENT VERIFIED — Stripe + guard OK on live HTML');
  console.log('FINGERPRINT GAP — publish index.html with source commit meta:');
  console.log('  npm run sync:source-fingerprint');
  console.log('  bash scripts/base44-partial-publish-wizard.sh → Publish');
} else {
  console.log('DEPLOYMENT NOT VERIFIED — CDN missing expected fixes');
}

console.log('');
console.log('Re-run after publish: node scripts/verify-deployment-trace.mjs');
console.log('══════════════════════════════════════════════════════════════\n');

const cdnBlockers = blockers.filter((b) => b.layer === 'CDN' || (b.layer === 'SOURCE' && b.status === 'FAIL'));
process.exit(cdnBlockers.length || !cdnCommitMatch ? 1 : 0);
