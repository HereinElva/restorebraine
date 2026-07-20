#!/usr/bin/env node
/**
 * All reasons changes fail to reach the iPhone — ranked by severity.
 * Read-only probes against live Base44 + repo config.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const HOSTED = 'https://restorebraine.base44.app';

/** Known stale/ghost assets still served on Base44 CDN (HTTP 200 forever). */
const GHOST_ASSETS = [
  { file: 'App-B4VcOATW.js', note: 'Stale gallery/CSS from partial Publish (primary blocker)' },
  { file: 'index-CLtZjYMv.js', note: 'Old index bundle → pointed at pre-v87 App chunks' },
  { file: 'App-BMryy2H5.js', note: 'Ghost App chunk linked from index-CLtZjYMv.js' },
];

export const STALE_APP = 'App-B4VcOATW.js';

function sha(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

async function head(url) {
  const res = await fetch(url, { method: 'HEAD', headers: { 'cache-control': 'no-cache' } });
  return {
    ok: res.ok,
    status: res.status,
    cacheControl: res.headers.get('cache-control') ?? '(none)',
    cfCache: res.headers.get('cf-cache-status') ?? '(none)',
    age: res.headers.get('age') ?? '0',
  };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  return { ok: res.ok, text: res.ok ? await res.text() : '', headers: Object.fromEntries(res.headers.entries()) };
}

function gitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

const blockers = [];
const warnings = [];
const clear = [];
const facts = [];

function block(id, title, why, fix) {
  blockers.push({ id, title, why, fix });
}
function warn(id, title, why, fix) {
  warnings.push({ id, title, why, fix });
}
function ok(id, title) {
  clear.push({ id, title });
}
function fact(id, title, why, fix) {
  facts.push({ id, title, why, fix });
}

console.log(`
═══════════════════════════════════════════════════════════════
 BLOCKAGE DIAGNOSIS — why changes don't reach your iPhone
═══════════════════════════════════════════════════════════════
 Git HEAD: ${gitHead()}   Live: ${HOSTED}
`);

// ── Permanent architecture facts (not failures) ────────────────────────────
fact(
  'ARCH-3LAYER',
  'Git push / Xcode / Mac terminal do NOT update iPhone UI',
  'Hosted Capacitor loads live Base44 JS. GitHub and Capacitor only change source/shell.',
  'Every src/ change: Base44 editor → paste → Publish ONCE → npm run why:no-change',
);

fact(
  'BASE44-NOCLI',
  'Base44 Publish is browser-only (no API, no git hook)',
  'Nothing pushed to GitHub reaches restorebraine.base44.app automatically.',
  'npm run base44:export-pack → paste in app.base44.com → Publish once',
);

// ── Live probes ─────────────────────────────────────────────────────────────
const htmlRes = await fetchText(HOSTED);
const html = htmlRes.text;
const deploy =
  html.match(/content="(v[0-9]+)"[^>]*restorebraine-deploy|restorebraine-deploy[^>]*content="(v[0-9]+)"/)?.[1]
  ?? html.match(/content="(v[0-9]+)"/)?.[1]
  ?? '?';
const liveIndexName = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const liveIndexRes = liveIndexName !== '?'
  ? await fetchText(`${HOSTED}/assets/${liveIndexName}`)
  : { ok: false, text: '', headers: {} };
const liveIndex = liveIndexRes.text;
const liveAppName = liveIndex.match(/assets\/(App-[^"]+\.js)/)?.[1] ?? '?';
const liveAppRes = liveAppName !== '?'
  ? await fetchText(`${HOSTED}/assets/${liveAppName}`)
  : { ok: false, text: '', headers: {} };

console.log('LIVE NOW (fresh probe, cache-busted):');
console.log(`  Deploy meta:     ${deploy}`);
console.log(`  Index bundle:    ${liveIndexName}`);
console.log(`  App bundle:      ${liveAppName}  ← gallery/CSS/UI`);
console.log('');

// ── BLOCKER 3: Stale App chunk still active ─────────────────────────────────
if (liveAppName === STALE_APP) {
  block(
    'STALE-APP',
    `Live site still serves stale ${STALE_APP}`,
    'Partial Publish updated index/OAuth but left old App chunk (gallery/CSS frozen).',
    'Full 71-file Publish → npm run why:no-change until App hash changes',
  );
} else if (liveAppName.startsWith('App-')) {
  ok('STALE-APP', `Live App is ${liveAppName} (not stale ${STALE_APP})`);
}

// ── BLOCKER 4: Ghost builds on CDN ──────────────────────────────────────────
console.log('GHOST BUILDS (old chunks still on CDN — cached phones can load them):');
for (const { file, note } of GHOST_ASSETS) {
  const h = await head(`${HOSTED}/assets/${file}`);
  const marker = h.ok ? '✗ STILL LIVE' : '✓ gone';
  console.log(`  ${marker}  ${file}  — ${note}`);
  if (h.ok && file !== liveAppName && file !== liveIndexName) {
    warn(
      `GHOST-${file}`,
      `Ghost asset ${file} still HTTP ${h.status}`,
      'Cloudflare keeps old hashed bundles forever. Cached WKWebView may still request them.',
      'Delete app → Restart iPhone. After Publish, index.html must point at NEW index-*.js hash.',
    );
  }
}
console.log('');

// ── BLOCKER 5: 7-day CDN cache on JS ────────────────────────────────────────
if (liveAppName !== '?') {
  const appHead = await head(`${HOSTED}/assets/${liveAppName}`);
  const maxAge = appHead.cacheControl.match(/max-age=(\d+)/)?.[1];
  if (maxAge && Number(maxAge) >= 86400) {
    warn(
      'CDN-CACHE',
      `JS cached ${Math.round(Number(maxAge) / 86400)} days (max-age=${maxAge})`,
      'Publish creates NEW hashed filenames (bypasses cache). OLD cached index.html can still point at old hashes.',
      'After Publish: confirm index.html references NEW index-*.js. Delete app + restart iPhone.',
    );
  }
}

// ── BLOCKER 6: Deploy label does not prove new publish ───────────────────────
if (deploy === 'v87') {
  warn(
    'DEPLOY-LABEL',
    'Deploy meta stuck at "v87" — cannot see publish progress from label alone',
    'HTML meta does not change unless you edit index.html. Same label can mask new App hashes.',
    'Track App chunk filename after each Publish: npm run why:no-change. Bump deploy-marker when ready.',
  );
}

// ── BLOCKER 7: iPhone WKWebView cache ───────────────────────────────────────
try {
  const delegate = readFileSync('ios/App/App/AppDelegate.swift', 'utf8');
  if (delegate.includes('clearCache: false')) {
    warn(
      'WK-CACHE',
      'AppDelegate OAuth browser uses clearCache: false',
      'WKWebView website data survives Xcode Run. Updating in place keeps old JS.',
      'Delete Restorebraine → Restart iPhone → Xcode Clean → Run (every time after Publish)',
    );
  }
} catch {}

// ── BLOCKER 8: Hosted vs bundled confusion ────────────────────────────────────
try {
  const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  if (cap.server?.appStartPath) {
    block(
      'BUNDLED-MODE',
      'appStartPath set — phone loads Mac bundle, not live Base44',
      'Bundled mode ignores Base44 Publish for UI.',
      'npm run cap:hosted && npm run nuke:v87',
    );
  } else {
    ok('HOSTED', 'Capacitor hosted mode (server.url → live Base44)');
  }
} catch {
  warn('CAP-CONFIG', 'capacitor.config.json missing', '', 'Run from restorebraine repo root');
}

// ── BLOCKER 9: Mac fallback bundle ≠ live ────────────────────────────────────
const pubDir = 'ios/App/App/public/assets';
if (existsSync(pubDir)) {
  const localApps = existsSync(pubDir)
    ? readdirSync(pubDir).filter((f) => f.startsWith('App-'))
    : [];
  if (localApps.length && liveAppName !== '?' && !localApps.includes(liveAppName)) {
    warn(
      'FALLBACK-MISMATCH',
      `Mac fallback ${localApps[0]} ≠ live ${liveAppName}`,
      'Normal in hosted mode — phone should NOT use fallback unless offline.',
      'If UI wrong while online: phone is not loading live Base44 (cache or wrong capacitor config).',
    );
  }
}

// ── BLOCKER 10: Misleading diagnostics ──────────────────────────────────────
warn(
  'FALSE-DIAG',
  'align:watch / old diagnose:chunks compared Mac dist hashes to Base44',
  'Base44 builds on their servers — filenames never match local vite output.',
  'Use: npm run why:no-change  and  npm run diagnose:blockages  (this script)',
);

// ── BLOCKER 11: Interactive scripts stop automation ─────────────────────────
warn(
  'PROMPT-BLOCK',
  'nuke:v87 / revert:v87-all pause for "Type YES" (iPhone delete/restart)',
  'Scripts exit if prompt not answered — looks like rebuild failed.',
  'REPLACE_APP_CONFIRMED=1 npm run revert:v87-all',
);

// ── BLOCKER 12: Partial Base44 paste ─────────────────────────────────────────
warn(
  'PARTIAL-PASTE',
  'Base44 AI chat sometimes skips files or Publish before all 71 files written',
  'OAuth-only paste fixes Sign In but leaves gallery on ghost App chunk.',
  'npm run verify:manifest && npm run base44:nuke-list — paste ALL files, Publish once',
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log(' ARCHITECTURE (always true — not bugs)');
console.log('═══════════════════════════════════════════════════════════════');
for (const f of facts) {
  console.log(`\n [${f.id}] ${f.title}`);
  console.log(`   Why:  ${f.why}`);
  console.log(`   Fix:  ${f.fix}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' BLOCKERS (must fix for changes to go through)');
console.log('═══════════════════════════════════════════════════════════════');
for (const b of blockers) {
  console.log(`\n [${b.id}] ${b.title}`);
  console.log(`   Why:  ${b.why}`);
  console.log(`   Fix:  ${b.fix}`);
}
if (!blockers.length) {
  console.log('\n  (none — live Base44 is on current App chunk)');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' WARNINGS (common traps)');
console.log('═══════════════════════════════════════════════════════════════');
for (const w of warnings) {
  console.log(`\n [${w.id}] ${w.title}`);
  console.log(`   Why:  ${w.why}`);
  console.log(`   Fix:  ${w.fix}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' CLEAR');
console.log('═══════════════════════════════════════════════════════════════');
for (const c of clear) {
  console.log(`  ✓ [${c.id}] ${c.title}`);
}

console.log(`
───────────────────────────────────────────────────────────────
 WORKFLOW FOR ANY FUTURE CHANGE (in order)
───────────────────────────────────────────────────────────────
  1. Edit src/ on Mac → commit/push GitHub (source of truth only)
  2. Base44 editor → paste changed files (or full pack) → Publish ONCE
  3. npm run why:no-change  → App chunk filename MUST change
  4. Delete app → Restart iPhone → Xcode Clean → Run
  5. npm run diagnose:blockages  → confirm no blockers

 30-SECOND PROOF: Safari on iPhone → ${HOSTED}
   Same as app = live Base44 (not Xcode). Different = WKWebView cache.

═══════════════════════════════════════════════════════════════
`);

process.exit(blockers.length ? 2 : warnings.length ? 1 : 0);
