#!/usr/bin/env node
/**
 * Diagnose the expected iPhone auth journey vs what Mac commands actually change.
 *
 * THREE SCREENS (do not confuse):
 *   1. Signed-out landing — "Find Your Memories" + Sign In button (NOT logged in yet)
 *   2. Login — Google OAuth (system browser opens when you tap Sign In)
 *   3. Front page — Gallery with "Find Your Memories" + search + photos (AFTER login)
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

function read(rel) {
  try {
    return readFileSync(resolve(rel), 'utf8');
  } catch {
    return '';
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

const iosCap = read('ios/App/App/capacitor.config.json');
const hosted = iosCap.includes('"url"') && iosCap.includes('restorebraine.base44.app');
const stamp = read('ios/App/App/BUILD_STAMP.txt').trim();

const omega3Files = [
  'src/lib/gallery-organize-snapshot.js',
  'src/lib/run-media-organize.js',
];
const githubHasOmega3 = omega3Files.every((f) => existsSync(f));

let liveIndex = '';
let liveApp = '';
let liveHtml = '';
try {
  liveHtml = await fetchText('https://restorebraine.base44.app/?rb_probe=' + Date.now());
  const m = liveHtml.match(/\/assets\/(index-[^"]+\.js)/);
  liveIndex = m?.[1] ?? '?';
  const appRes = await fetch(`https://restorebraine.base44.app/assets/${liveIndex}`, {
    headers: { 'cache-control': 'no-cache' },
  });
  const idxText = appRes.ok ? await appRes.text() : '';
  const appM = idxText.match(/App-[A-Za-z0-9_-]+\.js/);
  liveApp = appM?.[0] ?? '?';
} catch {}

let liveHasSignedOut = false;
let liveHasGalleryOrganize = false;
if (liveApp && liveApp !== '?') {
  try {
    const appText = await fetchText(`https://restorebraine.base44.app/assets/${liveApp}`);
    liveHasSignedOut = appText.includes('SignedOutLanding') || (appText.includes('Find Your') && appText.includes('Sign In'));
    liveHasGalleryOrganize = appText.includes('gallery-organize') || appText.includes('run-media-organize') || appText.includes('REFRESH_SAFETY');
  } catch {}
}

console.log(`
═══════════════════════════════════════════════════════════════
 AUTH FLOW DIAGNOSIS — login screen vs front page (Find Your Memories)
═══════════════════════════════════════════════════════════════
`);

console.log('EXPECTED FLOW ON IPHONE (v87 — do not confuse these)');
console.log('');
console.log('  STEP 1 — Signed-out landing (you are NOT logged in yet)');
console.log('    • Shows "Find Your Memories" headline + grey search hint');
console.log('    • Purple "Sign In" button at bottom');
console.log('    • This is NOT the full gallery — no photos, no organize buttons');
console.log('');
console.log('  STEP 2 — Login (tap Sign In)');
console.log('    • Google OAuth opens in system browser / ASWebAuthenticationSession');
console.log('    • Pick Google account → returns to app with token');
console.log('');
console.log('  STEP 3 — Front page (AFTER login — authenticated Gallery)');
console.log('    • Same "Find Your Memories" headline BUT with working search bar');
console.log('    • Organize / folder buttons when you have photos');
console.log('    • Bottom nav: Gallery, Upload, Account');
console.log('');

console.log('WHAT YOUR MAC COMMANDS CHANGE');
console.log('');
console.log('  npm run apply:v87-from-omega3');
console.log('    • Ports Omega 3 gallery improvements into src/ (GitHub files)');
console.log('    • Default: BUNDLED mode — phone loads capacitor:// ios/public from Mac/Xcode');
console.log('    • Does NOT use Base44 Publish — terminal Mac controls UI');
console.log('');
console.log('  npm run fix:no-change');
console.log('    • git reset --hard → syncs to branch (does NOT delete committed gallery files)');
console.log('    • Sets HOSTED mode → phone loads https://restorebraine.base44.app');
console.log('    • Updates native shell only (AppDelegate, BUILD_STAMP, ghost list)');
console.log('    • Does NOT Base44 Publish → omega3 gallery tweaks may be missing on CDN');
console.log('');
console.log('  npm run audit:v87-improvements');
console.log('    • Read-only check — never changes phone, build mode, or src/');
console.log('');

console.log('CURRENT STATE');
console.log(`  BUILD_STAMP:        ${stamp || '(missing)'}`);
console.log(`  Phone mode:         ${hosted ? 'HOSTED (live Base44 CDN)' : 'BUNDLED (ios/public — experimental)'}`);
console.log(`  GitHub Omega3 files: ${githubHasOmega3 ? 'present ✓' : 'MISSING — run npm run port:omega3-gallery'}`);
console.log(`  Live CDN entry:     ${liveIndex} → ${liveApp}`);
console.log(`  Live has Sign In flow: ${liveHasSignedOut ? 'yes ✓' : 'unknown (minified)'}`);
console.log(`  Live has Omega3 gallery code: ${liveHasGalleryOrganize ? 'likely yes' : 'NO — needs Base44 Publish'}`);
console.log('');

const issues = [];

if (hosted && githubHasOmega3 && !liveHasGalleryOrganize) {
  issues.push({
    title: 'Omega 3 gallery improvements are in GitHub but NOT on live Base44 CDN',
    why: 'Hosted mode loads CDN JS, not Mac src/. export-pack writes a Mac file only — you must Publish in Base44 browser.',
    fix: 'npm run base44:login-pack → follow npm run base44:publish-steps → Publish in browser → npm run prove:live-publish',
  });
}

if (hosted && liveHtml.includes('function platformLogin(fromUrl)')) {
  issues.push({
    title: 'Live CDN index.html has inline login guard (duplicate of AppDelegate)',
    why: 'Can interfere with native OAuth on some builds; Base44 Publish index.html removes it',
    fix: 'npm run base44:login-pack → publish index.html from pack in Base44 browser',
  });
}

if (issues.length) {
  console.log('HOSTED CDN ISSUES (bundled mode skips these — phone loads ios/public)');
  console.log('');
  for (const { title, why, fix } of issues) {
    console.log(`  ✗ ${title}`);
    console.log(`    Why: ${why}`);
    console.log(`    Fix: ${fix}`);
    console.log('');
  }
} else if (hosted) {
  console.log('✓ Hosted CDN checks OK — if still broken:');
  console.log('  Delete app → Restart iPhone → Xcode Clean Build Folder → Run');
  console.log('  Safari Web Inspector → Console for JS errors');
} else {
  console.log('✓ Bundled mode — Mac controls UI (apply default). Steady path:');
  console.log('  npm run prove:phone && npm run ghosts:prove-apply && npm run gate:mode');
  console.log('  Delete app → Restart iPhone → Xcode Clean → Run');
  console.log('  Do NOT run fix:no-change (switches to HOSTED CDN)');
}

console.log('');
console.log('RECOVERY (Step 1 Sign In → Step 2 OAuth → Step 3 Gallery)');
console.log('  cd ~/restorebraine');
console.log('  git fetch origin cursor/apple-privacy-plist-bacf');
console.log('  git reset --hard origin/cursor/apple-privacy-plist-bacf');
console.log('  npm install');
if (hosted) {
  console.log('  npm run fix:no-change                    # keeps HOSTED');
} else {
  console.log('  npm run apply:v87-from-omega3            # keeps BUNDLED (default)');
}
console.log('  # Delete app → Restart iPhone → Clean → Run');
console.log('');

process.exit(issues.length ? 1 : 0);
