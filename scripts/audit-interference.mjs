#!/usr/bin/env node
/**
 * Deep audit: native shell + repo scripts that override or block hosted/bundled UI updates.
 * Run: npm run audit:interference
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { resolveLiveActiveAssets } from './ghost-builds-registry.mjs';

const fail = [];
const warn = [];
const pass = [];

function ok(msg) { pass.push(msg); }
function note(msg) { warn.push(msg); }
function bad(msg) { fail.push(msg); }

function read(path) {
  try { return readFileSync(resolve(path), 'utf8'); } catch { return ''; }
}

function bundledAssets() {
  const dir = resolve('ios/App/App/public/assets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.js'));
}

function parseGhostLists(text) {
  const block = [];
  const allow = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('+')) allow.push(t.slice(1).trim());
    else block.push(t);
  }
  return { block, allow };
}

console.log(`
═══════════════════════════════════════════════════════════════
 INTERFERENCE AUDIT — blocks on updated + hosted builds
═══════════════════════════════════════════════════════════════
`);

// ── 1. AppDelegate ghost purge ───────────────────────────────────────────────
const delegate = read('ios/App/App/AppDelegate.swift');
const iosCapText = read('ios/App/App/capacitor.config.json');
const iosBundled = iosCapText && !iosCapText.includes('"url"');

if (delegate.includes('bundledMinimalBridgeScript') || delegate.includes('__restorebraineMinimalBridge')) {
  ok('AppDelegate bundled mode uses minimal bridge (no Location patches at boot)');
} else if (iosBundled && delegate.includes('installLocationNavigationGuard')) {
  bad('AppDelegate full bridge on bundled — Location patches cause white screen');
}

if (delegate.includes('if (location.protocol === \'capacitor:\') return')) {
  ok('AppDelegate purgeGhostBuilds skips bundled (capacitor://)');
} else if (!iosBundled) {
  note('Hosted mode — ghost purge active on restorebraine.base44.app');
}

if (delegate.includes("location.search.indexOf('rb_nocache=') >= 0) return")) {
  bad('AppDelegate rb_nocache early-exit — ghost purge stops after first reload (no-change trap)');
} else if (delegate.includes('rb_ghost_reload_count')) {
  ok('AppDelegate reloadFresh uses sessionStorage counter (no rb_nocache early-exit trap)');
}

if (delegate.includes('PerformanceObserver') && delegate.includes('GHOST_FILES')) {
  bad('AppDelegate purgeGhostBuilds uses PerformanceObserver on full blocklist — cached assets false-positive');
} else if (delegate.includes('do NOT scan performance entries')) {
  ok('AppDelegate ghost purge: DOM-only (no performance blocklist false positives)');
} else if (delegate.includes('hasStaleScriptInDom')) {
  ok('AppDelegate ghost purge: stale script DOM check only');
}

if (delegate.includes('function fixFolderActionButtons()') && delegate.includes('Disabled')) {
  ok('AppDelegate fixFolderActionButtons disabled (!important CSS no longer overrides Publish)');
} else if (delegate.includes('rb-folder-actions-fix')) {
  bad('AppDelegate fixFolderActionButtons still injects !important CSS every 1s — overrides Base44 UI');
}

if (delegate.includes('reloadAfterCachePurgeIfNeeded')) {
  ok('AppDelegate reloads WebView after BUILD_STAMP cache purge (fixes async purge race)');
} else {
  note('AppDelegate missing post-purge WebView reload — WKWebView may load stale cache before purge finishes');
}

const intervalMatch = delegate.match(/installPlatformGuard[\s\S]*?setInterval\(function \(\) \{[\s\S]*?\}, (\d+)\)/);
if (intervalMatch) {
  const ms = Number(intervalMatch[1]);
  if (ms >= 5000) ok(`AppDelegate platform guard interval ${ms}ms (not hammering DOM)`);
  else bad(`AppDelegate platform guard interval ${ms}ms — overrides Publish UI on every tick`);
} else if (delegate.includes('setInterval(function () {') && delegate.includes('guardSignedOutLoginPage')) {
  note('Could not parse AppDelegate platform guard interval');
}

// ── 2. Triple login guard stacking ───────────────────────────────────────────
const rootIndex = read('index.html');
const bundledIndex = read('ios/App/App/public/index.html');
const inlineGuard = /function platformLogin\(fromUrl\)/;

if (inlineGuard.test(rootIndex)) {
  bad('index.html still has inline login-redirect guard (triples with login-redirect.js + AppDelegate)');
} else if (rootIndex.includes('login-redirect.js')) {
  ok('index.html uses login-redirect.js only (no inline duplicate)');
}

if (bundledIndex.includes('crossorigin')) {
  bad('ios/public/index.html has crossorigin on script — breaks capacitor:// (white screen)');
} else {
  ok('ios/public/index.html has no crossorigin (Capacitor WKWebView safe)');
}

if (inlineGuard.test(bundledIndex)) {
  bad('ios/public/index.html still has inline login guard');
} else if (bundledIndex.includes('login-redirect.js')) {
  ok('ios/public/index.html uses login-redirect.js only');
}

try {
  const liveHtml = execSync(
    `curl -sS "https://restorebraine.base44.app/?rb_probe=$(date +%s)" -H 'cache-control: no-cache'`,
    { encoding: 'utf8', timeout: 15000 },
  );
  if (inlineGuard.test(liveHtml)) {
    note('LIVE CDN index.html still has inline login guard — Base44 Publish index.html needed');
  } else {
    ok('Live CDN index.html has no inline login guard duplicate');
  }
} catch {
  note('Could not probe live CDN index.html');
}

// ── 3. Ghost blocklist false positives ───────────────────────────────────────
const ghostText = read('ios/App/App/ghost-builds.txt');
const { block, allow } = parseGhostLists(ghostText);
const bundled = bundledAssets();
const blockedBundled = bundled.filter((f) => block.includes(f) && !allow.includes(f));

if (blockedBundled.length) {
  bad(`Bundled assets in BLOCK list (ghost purge may redirect hosted): ${blockedBundled.join(', ')}`);
  note('Fix: npm run ghosts:sync (sync script adds ios/public assets to ALLOW)');
} else if (bundled.length) {
  ok(`All ${bundled.length} bundled JS files allowed or not blocklisted`);
}

let liveActive = [];
try {
  ({ active: liveActive } = await resolveLiveActiveAssets());
  const blockedLive = liveActive.filter((f) => block.includes(f) && !allow.includes(f));
  if (blockedLive.length) {
    bad(`LIVE CDN chunks in BLOCK list: ${blockedLive.join(', ')}`);
  } else {
    ok(`Live CDN deps (${liveActive.length} files) not falsely blocklisted`);
  }
} catch (e) {
  note(`Live CDN probe failed: ${e.message}`);
}

// ── 4. native-platform-guard polling ─────────────────────────────────────────
const platformGuard = read('src/lib/native-platform-guard.js');
const pgInterval = platformGuard.match(/setInterval\([^,]+,\s*(\d+)\)/);
if (pgInterval) {
  const ms = Number(pgInterval[1]);
  if (ms >= 5000) ok(`native-platform-guard.js interval ${ms}ms`);
  else bad(`native-platform-guard.js polls every ${ms}ms — DOM guards fight Publish updates`);
}

// ── 5. Capacitor mode ────────────────────────────────────────────────────────
try {
  const cap = JSON.parse(read('capacitor.config.json') || '{}');
  if (cap.server?.appStartPath) {
    bad('capacitor.config.json appStartPath set — phone ignores Base44 Publish');
  } else if (cap.server?.url?.includes('restorebraine.base44.app')) {
    ok('Capacitor hosted mode (server.url → live Base44)');
  }
} catch {}

// ── 6. BUILD_STAMP once-only cache purge ─────────────────────────────────────
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();
if (stamp) {
  ok(`BUILD_STAMP present: ${stamp.slice(0, 60)}…`);
  note('WKWebView cache only purges when BUILD_STAMP changes — run npm run blocks:clear after pull');
} else {
  warn.push('BUILD_STAMP.txt missing');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('PASS');
for (const p of pass) console.log(`  ✓ ${p}`);
console.log('\nWARNINGS');
if (!warn.length) console.log('  (none)');
for (const w of warn) console.log(`  ⚠ ${w}`);
console.log('\nFAIL (must fix — cause no-change on hosted/bundled)');
if (!fail.length) console.log('  (none)');
for (const f of fail) console.log(`  ✗ ${f}`);

console.log(`
───────────────────────────────────────────────────────────────
 If any FAIL: npm run blocks:clear → Delete app → Restart iPhone → Xcode Clean → Run
 Hosted UI still needs Base44 Publish after src/ changes
───────────────────────────────────────────────────────────────
`);

process.exit(fail.length ? 2 : warn.length ? 1 : 0);
