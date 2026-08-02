#!/usr/bin/env node
/**
 * Verify Base44 Publish actually landed on live CDN.
 * Run AFTER clicking Publish in Base44 editor.
 */
const HOSTED = 'https://restorebraine.base44.app';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  return { ok: res.ok, text: res.ok ? await res.text() : '', status: res.status };
}

async function main() {
  console.log(`
══════════════════════════════════════════════════════════════
 PROVE LIVE PUBLISH — did Base44 actually update?
══════════════════════════════════════════════════════════════
`);

  const { text: html, ok } = await fetchText(`${HOSTED}/?rb_probe=${Date.now()}`);
  if (!ok) {
    console.log('✗ Could not fetch live site');
    process.exit(1);
  }

  const deployMeta = html.match(/restorebraine-deploy" content="(v\d+)"/)?.[1] ?? '?';
  const indexBundle = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
  const inlineGuard = html.includes('function platformLogin(fromUrl)');
  const crossorigin = html.includes('crossorigin');

  let appBundle = '?';
  let hasOmega3 = false;
  let hasSignedOut = false;

  if (indexBundle !== '?') {
    const { text: idx } = await fetchText(`${HOSTED}/assets/${indexBundle}`);
    const appM = idx.match(/App-[A-Za-z0-9_-]+\.js/);
    appBundle = appM?.[0] ?? '?';
    if (appBundle !== '?') {
      const { text: app } = await fetchText(`${HOSTED}/assets/${appBundle}`);
      hasOmega3 =
        app.includes('gallery-organize') ||
        app.includes('run-media-organize') ||
        app.includes('REFRESH_SAFETY');
      hasSignedOut = app.includes('Sign In') && app.includes('Find Your');
    }
  }

  console.log(` Live deploy meta:     ${deployMeta}`);
  console.log(` Live index bundle:    ${indexBundle}`);
  console.log(` Live App bundle:      ${appBundle}`);
  console.log(` Inline login guard:   ${inlineGuard ? 'YES ✗ (publish index.html from pack)' : 'no ✓'}`);
  console.log(` Sign In + landing:    ${hasSignedOut ? 'yes ✓' : 'unknown'}`);
  console.log(` Omega3 gallery code:  ${hasOmega3 ? 'yes ✓' : 'NO (need full BASE44-PASTE-PACK publish)'}`);
  console.log('');

  const issues = [];
  if (inlineGuard) {
    issues.push('Publish index.html from BASE44-LOGIN-PACK-v87.txt — removes duplicate inline guard');
  }
  if (!hasOmega3) {
    issues.push('Omega 3 gallery: publish full BASE44-PASTE-PACK-v87.txt (79 files) then Publish once');
  }
  if (indexBundle === 'index-BtNzh8Fh.js' && !hasOmega3 && inlineGuard) {
    issues.push('Live CDN unchanged since last check — did you click Publish in Base44 browser?');
  }

  if (issues.length) {
    console.log('NOT PUBLISHED YET (or partial publish):');
    for (const i of issues) console.log(`  • ${i}`);
    console.log('');
    console.log('Run: npm run base44:login-pack');
    console.log('Then follow the printed browser steps — export alone does not change the phone.');
    process.exit(1);
  }

  console.log('✓ Live CDN looks updated. Delete app → Restart iPhone → Clean → Run.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
