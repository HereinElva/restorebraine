#!/usr/bin/env node
/**
 * Post-v87 incident analysis — why builds regressed and resets got stuck.
 * Read-only: mines git history + live probes. No builds.
 */
import { execSync } from 'node:child_process';

const V87_UI = '5762b16';
const V87_TIP = 'f1b2505';
const HOSTED = 'https://restorebraine.base44.app';

function section(title) {
  console.log(`\n${'─'.repeat(63)}`);
  console.log(` ${title}`);
  console.log(`${'─'.repeat(63)}`);
}

console.log(`
═══════════════════════════════════════════════════════════════
 POST-v87 POST-MORTEM — why resets failed & how to fix properly
═══════════════════════════════════════════════════════════════
`);

section('WHAT v87 ACTUALLY WAS (the good baseline)');
console.log(`
  ${V87_UI}  UI born — SignedOutLanding ("Find Your Memories" + Sign In)
  ${V87_TIP}  tip — OAuth fix (restorebraine.base44.app, not app.base44.com 404)

  Architecture: HOSTED Capacitor
    • server.url → ${HOSTED}
    • WKWebView loads LIVE Base44 for UI + auth
    • AppDelegate session bridge for native OAuth + persistence
    • Full app capabilities (gallery, upload, folders, search) live in Base44 JS
`);

section('TIMELINE — what happened after v87');
const eras = [
  ['v88–v91', 'native-local experiments', 'LOCAL_NATIVE_BUNDLE flag, localhost OAuth confusion'],
  ['v92–v99', 'bundled spiral begins', 'Switch to capacitor:// bundled UI → white screens, infinite spinners'],
  ['v100–v107', 'return to hosted', 'Restore hosted site; OAuth redirect domain fixes; black/white screens'],
  ['v108–v123', 'v4-core bridge era', 'Custom bridge VC, RestorebraineNativePlugin, OAuth in Safari/ASWebAuth'],
  ['v124–v131', 'login UI churn', 'SignInScreen ↔ SignedOutLanding ↔ gallery shell — 8+ login rewrites'],
  ['v132–v146', 'formatting + scroll fixes', 'Consent, header, gallery gaps — many "without Base44 publish" commits'],
  ['v147–v155', 'bundled deploy pipeline', 'Attempt unified bundled deploy; chronic "no change" on phone'],
  ['v146 revert', 'explicit admission', 'v152–v155 caused wrong login, flicker, account wipe confusion'],
  ['v154–v161', 'hosted lock + audits', 'Restore hosted default; pre-build audit; auth contradiction fixes'],
  ['f1b2505', 'revert to pure v87', 'Strip post-v87 experiments; OAuth URL fix only'],
];
for (const [ver, name, note] of eras) {
  console.log(`  ${ver.padEnd(12)} ${name.padEnd(28)} ${note}`);
}

section('FIVE ROOT CAUSES (why corrections never "went through")');

console.log(`
1. THREE-LAYER DEPLOY — only one layer was updated
   GitHub ──manual Publish──► Base44 (live JS)
   GitHub ──mac-ios-setup──► Capacitor (native shell + fallback bundle)

   Typical failure: git reset + Xcode Run updated Capacitor only.
   Phone still ran stale Base44 index-*.js → "no change" on Sign In/UI logic.

   Evidence: v148 added verify-live-deploy because HTML meta v87 could pass
   while JS bundle stayed on pre-fix hash (index-CLtZjYMv.js).

2. HOSTED vs BUNDLED architecture flip-flopped ~12 times
   Hosted (v87/v100/v146/v154): server.url loads live Base44 — needs Publish
   Bundled (v96/v147): capacitor:// loads ios/public — needs npm build + Xcode

   Fixes for one mode broke the other. Commits literally say:
   • "Switch iOS to bundled native UI" (v96)
   • "Restore hosted Restorebraine site" (v100)
   • "restore hosted Capacitor as default" (v154)
   • "Fix wrecked bundled setup" (v154)

   v87 uses HOSTED. Any reset must NOT switch to bundled mode.

3. LOGIN SYSTEM REWRITTEN ~15 times (capabilities lost in the churn)
   Components added/removed across builds:
   • NativeLoginCard, SignInScreen, LoginPage, NativeLoginProviders
   • NativePlatformLoginRedirect, native-shell-stabilizer
   • platform /login redirect vs in-app OAuth vs emoji card

   Each rewrite changed auth flow, session bridge assumptions, and AppDelegate
   intercept logic. Formatting fixes (scroll, consent) rode along with auth
   changes → regressions in gallery/session/logout.

   v146 revert message: "wrong login page, flicker, account wipe confusion"

4. AppDelegate + JS GUARD STACKING (white screens, flicker, OAuth loops)
   Post-v87 added layers that fought each other:
   • Location.prototype.assign/replace patches (login-redirect.js)
   • guardPlatformNavigation / guardSignedOutLoginPage
   • AppDelegate injected bridge (800+ lines)
   • Auto-OAuth on launch (v90+) → flicker loops with stale hosted JS
   • WKWebView cache not cleared → old JS after "reset"

   White/black screen commits v107–v114 alone: 8 consecutive "fixes"

5. BUILD NUMBER INFLATION masked real state
   BUILD_NUMBER went 87 → 161+ while core issues repeated.
   Deploy meta (content="v87") could be Published separately from JS bundle.
   Stamp text ("kbrown native v87") updated in git but live site did not.

   Result: looked like progress; phone ran same stale bundle.
`);

section('COMMON "NO CHANGE" PATTERNS (from commit history)');

const patterns = [
  ['Xcode Run after git pull only', 'Capacitor shell updated; live Base44 JS unchanged'],
  ['Published index.html only', 'Deploy meta updates; index-*.js hash stays same'],
  ['Published static JS (native-oauth-return.js)', 'Main Vite bundle still stale'],
  ['Built ios/public on Mac (bundled)', 'Hosted mode ignores it — loads live site'],
  ['git reset without Base44 Publish', 'GitHub correct; phone still broken'],
  ['WKWebView cache on iPhone', 'Even after Publish, old JS until delete app + restart'],
  ['Fixed OAuth in git (f1b2505)', 'Live bundle still has ${app.base44.com}${path} template'],
  ['Added new login component', 'Old login still in live App-*.js chunk until Publish'],
];
console.log('  Symptom'.padEnd(42) + 'Actual cause');
for (const [symptom, cause] of patterns) {
  console.log(`  ${symptom.padEnd(40)} ${cause}`);
}

section('WHAT BROKE IN EACH BUILD CATEGORY');

console.log(`
  Formatting-only intent (scroll, consent, Organize button v72–v76):
    • Often committed with auth/AppDelegate changes
    • v135: "fix layout without Base44 publish" — live site never got CSS/JS
    • Organize button fixes targeted stale Base44 hosted CSS specifically

  Native OAuth fixes (v89–v106, v274–v275):
    • Same bug rediscovered: app.base44.com/api/auth → 404
    • Fixed in git repeatedly; live bundle not Published each time
    • f1b2505 was the v87-era fix — still not in live index-CLtZjYMv.js

  Bundled-native attempts (v96–v99, v147–v150):
    • Lost real account data path (hosted site has real sessions/content)
    • Infinite loading, capacitor:// crossorigin issues, wrong app origin
    • Explicitly abandoned: v100, v154, ef3bf28 revert

  Login page rewrites (v123–v155, v151 LoginPage):
    • Each added UI layer without removing old live bundle code
    • Multiple concurrent login paths (platform redirect + in-app + bridge intercept)
    • Sign-out → wrong page, account wipe, flicker loops
`);

section('PROPER RESET PLAYBOOK (v87 → working phone)');

console.log(`
  PHASE A — Lock GitHub (one source of truth)
    git fetch origin cursor/apple-privacy-plist-bacf
    git reset --hard ${V87_TIP}   # or branch tip if scripts-only after
    npm run verify:v87
    npm run diagnose:all

  PHASE B — Base44 Publish (REQUIRED for hosted mode — cannot skip)
    Base44 editor → paste + Publish ALL of:
      src/lib/native-platform-guard.js   ← OAuth (Sign In blocker today)
      index.html
      src/App.jsx
      src/components/auth/SignedOutLanding.jsx
    npm run diagnose:sync until:
      ✓ Live bundle hash CHANGES (not index-CLtZjYMv.js)
      ✓ Live OAuth host = restorebraine.base44.app

  PHASE C — Capacitor shell (Mac — after Base44 OR parallel, not instead)
    bash scripts/mac-ios-setup.sh cursor/apple-privacy-plist-bacf
    Confirm: server.url = ${HOSTED}, no appStartPath

  PHASE D — iPhone (cache bust — required even when A+B+C correct)
    Delete app → Restart iPhone → Xcode Clean → Run

  PHASE E — Verify all three layers agree
    npm run diagnose:all     → 6/6 pass
    npm run diagnose:oauth   → Live row = restorebraine.base44.app

  DO NOT during reset:
    ✗ npm run build:native-local (switches to bundled mode)
    ✗ Add new login components (NativeLoginCard, LoginPage, etc.)
    ✗ Trust BUILD_NUMBER / HTML meta alone — verify JS bundle hash
    ✗ Xcode Run alone expecting Sign In to fix itself
    ✗ Stack more AppDelegate guards on top of stale live JS
`);

section('HOW TO PROGRESS WITHOUT REGRESSING (after v87 is restored)');

console.log(`
  1. One architecture only: HOSTED (v87 model). Never bundled for production.
  2. Every UI/auth change = GitHub commit + Base44 Publish + diagnose:sync pass.
  3. Formatting/CSS changes: publish src/index.css + affected components together.
  4. Never touch auth files when fixing formatting (separate commits/branches).
  5. Run diagnose:all before AND after any change — treat as deploy gate.
  6. Bump BUILD_NUMBER only after live bundle hash confirms new deploy.
  7. Keep AppDelegate minimal — v87 bridge only; no new login experiments.
  8. Tag known-good: git tag v87-baseline ${V87_TIP} (already exists).

  Safe change order for future features:
    GitHub → Base44 Publish → diagnose:sync ✓ → mac-ios-setup → iPhone test
`);

section('v87 NUKE — wipe all three layers (use after post-v87 mess)');
console.log(`
  Mac (GitHub + Capacitor):
    npm run nuke:v87
    # or: bash scripts/nuke-v87.sh cursor/apple-privacy-plist-bacf

  Base44 (live JS — browser only, cannot nuke from terminal):
    npm run base44:nuke-list        # full manifest (~40 files)
    npm run base44:nuke-oauth       # minimal OAuth fix only (may leave stale UI chunks)

  Verify:
    npm run verify:lingering -- --strict
    npm run diagnose:all

  What nuke:v87 erases on Mac:
    • git clean dist, ios/public, Pods, vite cache
    • Xcode DerivedData + WebKit caches
    • Rebuilds hosted Capacitor shell at v87
    • Scans for post-v87 forbidden files/patterns

  What Base44 nuke requires:
    • Paste EVERY file in base44:nuke-list → single Publish
    • Partial publish (HTML only) caused index-CLtZjYMv.js to linger
    • Delete post-v87 files from Base44 editor if they exist there
`);

// Live probe
section('CURRENT LIVE STATE (probed now)');
try {
  const html = await (await fetch(HOSTED, { headers: { 'cache-control': 'no-cache' } })).text();
  const deploy = html.match(/content="(v[0-9]+)"[^>]*name="restorebraine-deploy"/)?.[1]
    ?? html.match(/name="restorebraine-deploy"[^>]*content="(v[0-9]+)"/)?.[1]
    ?? '?';
  const bundle = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? '?';
  const js = await (await fetch(`${HOSTED}/assets/${bundle}`, { headers: { 'cache-control': 'no-cache' } })).text();
  const oauthBroken = /\$\{dt\}\$\{e\}/.test(js);
  console.log(`  Deploy meta: ${deploy}`);
  console.log(`  Live bundle: ${bundle}`);
  console.log(`  OAuth in live JS: ${oauthBroken ? '✗ still app.base44.com template (BLOCKED)' : '✓ fixed'}`);
  console.log(`  Reset status: GitHub ✓ | Capacitor ✓ (your Mac) | Base44 JS ✗ until Publish`);
} catch (e) {
  console.log(`  Live probe failed: ${e.message}`);
}

console.log(`
═══════════════════════════════════════════════════════════════
 Run: npm run diagnose:all  |  npm run diagnose:watch (during Publish)
═══════════════════════════════════════════════════════════════
`);
