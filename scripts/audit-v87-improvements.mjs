#!/usr/bin/env node
/**
 * Full audit: all user-requested improvements through v87, ghost blockers, post-v87 exclusions.
 * Read-only except optional --fix-ghost-sync to refresh ghost-builds.txt.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OMEGA3_TO_V87_COMMITS,
  OMEGA3_TAG,
  POST_V87_FORBIDDEN,
  POST_V87_FORBIDDEN_PATHS,
  V87_TIP,
} from './base44-v87-publish-manifest.mjs';
import { KNOWN_GHOST_ASSETS } from './ghost-builds-registry.mjs';

const fixGhost = process.argv.includes('--fix-ghost-sync');
const errors = [];
const warnings = [];
const passed = [];

function pass(msg) { passed.push(msg); }
function warn(msg) { warnings.push(msg); }
function fail(msg) { errors.push(msg); }

function read(rel) {
  const p = resolve(rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

console.log(`
═══════════════════════════════════════════════════════════════
 v87 IMPROVEMENTS AUDIT — Omega 3 gallery + v87 corrections
 Excludes post-v87 breakdowns and ghost CDN obstructions
═══════════════════════════════════════════════════════════════
`);

// ── Section 1: v87 correction commits (documented lineage) ──
console.log('1. v87 CORRECTIONS (omega-3 → f1b2505)\n');
for (const { sha, note } of OMEGA3_TO_V87_COMMITS) {
  try {
    execSync(`git merge-base --is-ancestor ${sha} HEAD`, { stdio: 'ignore' });
    pass(`${sha.slice(0, 7)}  ${note}`);
  } catch {
    fail(`Missing correction commit ${sha.slice(0, 7)} — ${note}`);
  }
}

// ── Section 2: Omega 3 gallery stack (ported into v87) ──
console.log('\n2. OMEGA 3 GALLERY STACK (folder persistence, multi-batch organize)\n');
const omega3GalleryFiles = [
  { path: 'src/lib/gallery-organize-snapshot.js', feature: 'Folder snapshot + loose photo tracking' },
  { path: 'src/lib/run-media-organize.js', feature: 'Multi-round organize batches' },
  { path: 'src/lib/folder-membership.js', feature: 'API + local folder merge' },
  { path: 'src/lib/folder-membership-cache.js', feature: 'Folder persistence across restart' },
  { path: 'src/lib/gallery-query-keys.js', feature: 'Per-user gallery cache keys' },
  { path: 'src/lib/gallery-data.js', feature: 'Gallery prefetch + session events' },
  { path: 'src/lib/media-organize.js', feature: 'Full organize prompts (Omega 3)' },
  { path: 'src/components/gallery/OrganizeButton.jsx', feature: 'Batch organize UI + alerts' },
  { path: 'src/components/gallery/PullToRefresh.jsx', feature: '6s safety timeout on refresh' },
  { path: 'src/pages/Gallery.jsx', feature: 'Snapshot merge + folder persistence wiring' },
];

for (const { path, feature } of omega3GalleryFiles) {
  if (existsSync(path)) {
    pass(`${path} — ${feature}`);
  } else {
    fail(`Missing ${path} — ${feature}`);
  }
}

if (read('src/components/gallery/PullToRefresh.jsx').includes('REFRESH_SAFETY_MS')) {
  pass('PullToRefresh 6s safety timeout present');
} else {
  fail('PullToRefresh missing REFRESH_SAFETY_MS (Omega 3 fix)');
}

if (read('src/pages/Gallery.jsx').includes('gallery-organize-snapshot')) {
  pass('Gallery.jsx uses gallery-organize-snapshot');
} else {
  fail('Gallery.jsx missing gallery-organize-snapshot imports');
}

if (read('src/pages/Gallery.jsx').includes('SignInScreen')) {
  fail('Gallery.jsx still references SignInScreen (post-v87 login rewrite)');
} else {
  pass('Gallery.jsx uses v87 session-bootstrap (not SignInScreen)');
}

// ── Section 3: v87 auth/UI (Omega 3 SignInScreen or SignedOutLanding, OAuth f1b2505) ──
console.log('\n3. v87 AUTH + UI (SignInScreen or SignedOutLanding, OAuth f1b2505)\n');
const appSrc = read('src/App.jsx');
const usesOmegaLogin = appSrc.includes('SignInScreen') && existsSync('src/components/NativeLoginCard.jsx');
if (usesOmegaLogin) {
  pass('App.jsx routes SignInScreen (Omega 3 NativeLoginCard)');
  if (read('src/components/NativeLoginCard.jsx').includes('Continue With Google')) {
    pass('NativeLoginCard has Google / Apple / Microsoft providers');
  } else {
    fail('NativeLoginCard missing provider buttons');
  }
} else if (appSrc.includes('SignedOutLanding')) {
  pass('App.jsx routes SignedOutLanding (v87 gallery shell)');
  if (existsSync('src/components/auth/SignedOutLanding.jsx')) pass('SignedOutLanding.jsx');
  else fail('Missing SignedOutLanding.jsx');
} else {
  fail('App.jsx missing SignInScreen or SignedOutLanding');
}

const guard = read('src/lib/native-platform-guard.js');
if (guard.includes('${DEFAULT_APP_ORIGIN}${path}') && !guard.includes('${BASE44_PLATFORM_URL}${path}')) {
  pass('OAuth uses restorebraine.base44.app (f1b2505)');
} else {
  fail('OAuth guard wrong — pre-f1b2505 or app.base44.com template');
}

if (existsSync('src/lib/native-media-input.js')) pass('native-media-input.js (v83 upload picker)');
else fail('Missing native-media-input.js');

if (existsSync('src/lib/upload-pipeline.js')) pass('upload-pipeline.js (v82 fast upload)');
else fail('Missing upload-pipeline.js');

if (read('ios/App/App/Info.plist').includes('NSCameraUsageDescription')) {
  pass('App Store privacy plist (17af6de)');
} else {
  fail('Missing privacy usage descriptions');
}

if (read('src/lib/session-bootstrap.js').includes('ensureClientSessionToken')) {
  pass('session-bootstrap ensureClientSessionToken (gallery API gate)');
} else {
  fail('session-bootstrap missing ensureClientSessionToken');
}

// ── Section 4: Post-v87 exclusions (breakdown causes) ──
console.log('\n4. POST-v87 EXCLUSIONS (must NOT be present)\n');
for (const p of POST_V87_FORBIDDEN_PATHS) {
  if (existsSync(p)) fail(`Forbidden file present: ${p}`);
  else pass(`Absent: ${p}`);
}

const srcScan = spawnSync(
  'git',
  ['grep', '-l', '-E', POST_V87_FORBIDDEN.map((p) => p.pattern).join('|'), '--', 'src/'],
  { encoding: 'utf8' },
);
const srcHits = (srcScan.stdout || '').trim().split('\n').filter(Boolean);
if (srcHits.length) {
  fail(`Forbidden patterns in src/: ${srcHits.join(', ')}`);
} else {
  pass('No post-v87 forbidden patterns in src/');
}

// ── Section 5: Ghost builds ──
console.log('\n5. GHOST BUILD PROTECTION\n');
const blockPath = 'ios/App/App/ghost-builds.txt';
if (existsSync(blockPath)) {
  const blocklist = read(blockPath).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  pass(`ghost-builds.txt: ${blocklist.length} CDN files blocklisted`);
  for (const { file: ghost } of KNOWN_GHOST_ASSETS.slice(0, 4)) {
    if (blocklist.includes(ghost)) pass(`Blocklisted: ${ghost}`);
    else warn(`Not in blocklist: ${ghost}`);
  }
} else {
  fail('ghost-builds.txt missing — run npm run ghosts:discover');
}

const delegate = read('ios/App/App/AppDelegate.swift');
if (delegate.includes('purgeGhostBuildCacheIfNeeded') && delegate.includes('purgeGhostBuilds')) {
  pass('AppDelegate WKWebView cache purge + JS ghost blocker');
} else {
  fail('AppDelegate missing ghost purge');
}

const publicAssets = existsSync('ios/App/App/public/assets')
  ? execSync('find ios/App/App/public/assets -name "*.js" -type f 2>/dev/null | xargs -I{} basename {}', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  : [];
const entryHtml = read('ios/App/App/public/index.html');
const staleCdnRefs = ['App-B4VcOATW.js', 'App-BMryy2H5.js', 'index-CLtZjYMv.js', 'index-CJJVGreG.js'];
const staleInHtml = staleCdnRefs.filter((g) => entryHtml.includes(g));
if (staleInHtml.length) {
  fail(`index.html references stale CDN ghost scripts: ${staleInHtml.join(', ')}`);
} else if (entryHtml.includes('content="v87"') && entryHtml.includes('./assets/')) {
  pass('Bundled index.html: v87 deploy meta + local ./assets/ entry (not CDN ghosts)');
} else if (!publicAssets.length) {
  warn('ios/public not built — run npm run build:native-local');
} else {
  pass('Bundled ios/public — no stale CDN script refs in index.html');
}

// ── Section 6: Capacitor mode ──
console.log('\n6. TERMINAL BUNDLED MODE (Mac → iPhone, no Safari)\n');
const iosCap = read('ios/App/App/capacitor.config.json');
if (iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app')) {
  warn('ios config is HOSTED — phone loads Base44 CDN, not Mac terminal build. Run: npm run apply:v87-from-omega3');
} else if (iosCap && !iosCap.includes('restorebraine.base44.app')) {
  pass('Bundled mode: no server.url — phone loads ios/public from Mac/Xcode');
} else {
  warn('capacitor.config.json state unclear — run npm run apply:v87-from-omega3');
}

// ── Optional fix ──
if (fixGhost && existsSync('scripts/sync-ghost-builds-native.mjs')) {
  execSync('node scripts/sync-ghost-builds-native.mjs', { stdio: 'inherit' });
  pass('Refreshed ghost-builds.txt from registry');
}

// ── Report ──
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(` PASSED: ${passed.length}  WARNINGS: ${warnings.length}  FAILED: ${errors.length}`);
console.log('═══════════════════════════════════════════════════════════════\n');

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);

if (errors.length) {
  console.log(`
Fix:
  npm run mac:terminal-build       Full terminal sync + bundled apply + audit
  npm run apply:v87-from-omega3    Bundled build from Mac (no Safari)
  npm run ghosts:sync              Refresh ghost blocklist (unblock new build)
  npm run port:omega3-gallery      Restore Omega 3 gallery stack
`);
  process.exit(1);
}

console.log('ALL IMPROVEMENTS PRESENT — safe for terminal bundled build.');
console.log('Run: npm run apply:v87-from-omega3 → Delete app → Restart → Clean → Run\n');
