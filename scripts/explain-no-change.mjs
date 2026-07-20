#!/usr/bin/env node
/**
 * Blunt explanation when iPhone shows "no change" after Mac/Xcode/terminal work.
 * Hosted Capacitor loads LIVE Base44 — probes prove what the phone actually runs.
 */
const HOSTED = 'https://restorebraine.base44.app';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  return res.text();
}

console.log(`
═══════════════════════════════════════════════════════════════
 WHY NOTHING CHANGES ON YOUR IPHONE
═══════════════════════════════════════════════════════════════

Your iPhone does NOT run code from your Mac or Xcode.
It loads: ${HOSTED}
Every pixel you see comes from Base44's live JavaScript bundles.

Mac terminal + Xcode Run + git reset = changes the NATIVE SHELL only.
Gallery, CSS, formatting, layout = live App-*.js on Base44.

Until Base44 Publish completes, the phone screen CANNOT change.
`);

const html = await fetchText(HOSTED);
const liveIndex = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
const deploy = html.match(/content="(v[0-9]+)"[^>]*restorebraine-deploy|restorebraine-deploy[^>]*content="(v[0-9]+)"/)?.[1]
  ?? html.match(/content="(v[0-9]+)"/)?.[1] ?? '?';

const indexJs = await fetchText(`${HOSTED}/assets/${liveIndex}`);
const liveApp = indexJs.match(/assets\/(App-[^"]+\.js)/)?.[1] ?? '?';

console.log('LIVE RIGHT NOW (what your iPhone is showing):');
console.log(`  Deploy label:  ${deploy}`);
console.log(`  Index bundle:  ${liveIndex}`);
console.log(`  App bundle:    ${liveApp}  ← gallery + CSS live HERE`);
console.log('');

const STALE_APP = 'App-B4VcOATW.js';
const FIXED_APP = 'App-D3fRHMQi.js';

if (liveApp === STALE_APP) {
  console.log('✗ BLOCKER CONFIRMED — live App chunk is STILL STALE');
  console.log(`  Phone is stuck on ${STALE_APP} from an old partial Publish.`);
  console.log(`  Git v87 build needs ${FIXED_APP} (or newer hash after full Publish).`);
  console.log('');
  console.log('  Every Mac/Xcode/terminal command you ran did NOT touch this file.');
  console.log('  That is why the screenshot never changes.');
} else if (liveApp.includes('App-')) {
  console.log(`✓ App chunk changed to ${liveApp} — Publish may have worked.`);
  console.log('  If UI still wrong: Delete app → Restart iPhone → Xcode Clean → Run');
} else {
  console.log('? Could not read App chunk from live bundle.');
}

console.log(`
───────────────────────────────────────────────────────────────
 30-SECOND PROOF (do this on iPhone now)
───────────────────────────────────────────────────────────────
  1. Open Safari on iPhone
  2. Go to: ${HOSTED}
  3. Sign in if asked

  You will see the SAME broken UI as the app screenshot.
  That proves Xcode is not the problem — Base44 live JS is.

───────────────────────────────────────────────────────────────
 THE ONLY FIX THAT CHANGES THE SCREEN
───────────────────────────────────────────────────────────────
  Mac terminal:
    npm run base44:export-pack

  Browser (required — no terminal alternative):
    1. https://app.base44.com → Restorebraine → Code editor
    2. Paste ALL 43 files from the export pack
    3. Click Publish ONCE (top right)

  Mac terminal (confirms it worked):
    npm run align:watch
    → waits until live App chunk is NO LONGER ${STALE_APP}

  Then iPhone:
    Delete Restorebraine → Restart iPhone → Xcode Clean → Run

───────────────────────────────────────────────────────────────
 IF GALLERY STILL SHOWS 0 AFTER UI FIXES
───────────────────────────────────────────────────────────────
  Account tab → check email matches the Google account that had photos.
  OAuth may have signed you into a different account.

═══════════════════════════════════════════════════════════════
`);

if (liveApp === STALE_APP) process.exit(2);
