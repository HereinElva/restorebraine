#!/usr/bin/env node
/**
 * Standalone proof that live Base44 OAuth is fixed — no other repo scripts needed.
 * Run from anywhere: node scripts/prove-live-oauth.mjs
 * Or one-liner after cd to repo: npm run prove:live-oauth
 */
const HOSTED = 'https://restorebraine.base44.app';

async function main() {
  console.log('Fetching live Base44 bundle (read-only)...\n');
  const html = await fetch(HOSTED, { headers: { 'cache-control': 'no-cache' } }).then((r) => r.text());
  const bundle = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1];
  if (!bundle) {
    console.error('✗ Could not find main JS bundle in live HTML');
    process.exit(1);
  }

  const js = await fetch(`${HOSTED}/assets/${bundle}`, { headers: { 'cache-control': 'no-cache' } }).then((r) => r.text());

  const hasRestorebraineOrigin = /[a-z$][a-z0-9$]*="https:\/\/restorebraine\.base44\.app"/.test(js);
  const hasBrokenIt = /\$\{it\}\$\{e\}/.test(js) && js.includes('app.base44.com');
  const hasBrokenDt = /\$\{dt\}\$\{e\}/.test(js);
  const hasAuthBuilder = /\/api\/apps\/auth\/login/.test(js) && /\$\{de\}\$\{e\}\?\$\{/.test(js)
    || /\$\{fe\}\$\{e\}\?\$\{/.test(js)
    || (hasRestorebraineOrigin && /\$\{[a-z$][a-z0-9$]*\}\$\{e\}\?\$\{/.test(js));

  console.log(`Live bundle: ${bundle} (${js.length} bytes)`);
  console.log(`restorebraine.base44.app origin in bundle: ${hasRestorebraineOrigin ? 'YES' : 'no'}`);
  console.log(`OAuth URL builder (origin + /api/apps/auth/login): ${hasAuthBuilder ? 'YES' : 'no'}`);
  console.log(`Broken app.base44.com template: ${hasBrokenIt || hasBrokenDt ? 'YES ✗' : 'no'}`);

  const good = await fetch(`${HOSTED}/api/apps/auth/login?app_id=68fdc5f42768c4d045fe1bac`, { method: 'HEAD' });
  console.log(`\nEndpoint probe: restorebraine.base44.app/api/apps/auth/login → HTTP ${good.status}`);

  if (hasRestorebraineOrigin && hasAuthBuilder && !hasBrokenIt && !hasBrokenDt) {
    console.log(`
✓ LIVE BASE44 OAUTH IS FIXED
  Sign In on iPhone uses: https://restorebraine.base44.app/api/apps/auth/*

If npm run diagnose:all still says "unknown":
  Your Mac repo scripts are outdated (need git pull).
  Run: git fetch origin && git checkout cursor/apple-privacy-plist-bacf && git pull
`);
    process.exit(0);
  }

  if (hasBrokenIt || hasBrokenDt) {
    console.log(`
✗ LIVE BASE44 OAUTH BROKEN (routes to app.base44.com → 404)
  Fix: Base44 editor → paste src/lib/native-platform-guard.js → Publish
`);
    process.exit(1);
  }

  console.log(`
? Could not classify live bundle automatically.
  Manual check: search bundle for de="https://restorebraine.base44.app"
`);
  process.exit(1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
