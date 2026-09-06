/**
 * Every known reason Capacitor-wrapped (hosted) fixes fail to appear on device.
 * Reports which scenarios APPLY vs NOT APPLY for this repo + live Base44 right now.
 *
 * Usage: node scripts/audit-capacitor-sync-scenarios.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE = 'https://restorebraine.base44.app';
const CANONICAL_BRANCH = 'cursor/fix-folder-persistence-bacf';
const KNOWN_STALE = ['index-mlcqt5ef.js', 'index-DVkubWP5.js', 'index-CGrESmC2.js'];

function read(p) {
  return readFileSync(resolve(p), 'utf8');
}

function curl(url, { head = false } = {}) {
  try {
    const flag = head ? '-sI' : '-sL';
    return execSync(`curl ${flag} --max-time 20 '${url}'`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function gitBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const deploy =
  read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const build =
  read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const branch = gitBranch();

const capIos = existsSync('ios/App/App/capacitor.config.json')
  ? read('ios/App/App/capacitor.config.json')
  : '';
const serverUrl = capIos.match(/"url"\s*:\s*"([^"]+)"/)?.[1] ?? '';
const hosted = serverUrl.includes('restorebraine.base44.app');
const bundledMode = existsSync('ios/App/App/BUNDLED_MODE.txt');
const stripeInNav = /stripe\.com/.test(capIos);

const liveHtml = curl(`${LIVE}/?t=${Date.now()}`);
const liveDeploy =
  liveHtml.match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1] ??
  liveHtml.match(/content="v(\d+)"[^>]*restorebraine-deploy/)?.[1] ??
  '?';
const liveBundle = liveHtml.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'unknown';
const liveHasGuardScript = /hosted-runtime-guard\.js/.test(liveHtml);
const guardFetch = curl(`${LIVE}/hosted-runtime-guard.js`);
const guardIsJs =
  guardFetch.includes('rbHostedRuntimeGuard') &&
  !guardFetch.trimStart().startsWith('<!DOCTYPE');

const localIndex = read('index.html');
const liveStripeInline = liveHtml;
const localStripeInline = localIndex;
const stripeInlineFixed =
  localStripeInline.includes('return openInApp(u)') &&
  !localStripeInline.includes('openInApp(u);return true');
const liveStripeInlineBroken =
  liveStripeInline.includes('openInApp(u);return true') ||
  (liveStripeInline.includes('function intercept(u)') &&
    liveStripeInline.includes('openInApp(u)') &&
    !liveStripeInline.includes('return openInApp(u)'));

let liveBundleBody = '';
if (liveBundle !== 'unknown') {
  liveBundleBody = curl(`${LIVE}/assets/${liveBundle}`);
}

const publishSources = [
  'scripts/generate-base44-publish.mjs',
  'scripts/base44-publish-wizard.sh',
  'scripts/list-base44-publish-files.mjs',
];
const mustPublish = [
  'public/hosted-runtime-guard.js',
  'src/components/RuntimeDiagnostic.jsx',
  'public/native-ui-scrub.js',
  'index.html',
];
const publishGaps = publishSources.flatMap((src) => {
  const body = read(src);
  return mustPublish.filter((p) => !body.includes(p)).map((p) => ({ src, path: p }));
});

const appDelegate = existsSync('ios/App/App/AppDelegate.swift')
  ? read('ios/App/App/AppDelegate.swift')
  : '';
const hasCacheReloadFix =
  /pendingCacheReload/.test(appDelegate) &&
  /reloadFromOrigin|loadRequest/.test(appDelegate);

const macCapSync = read('scripts/mac-capacitor-web-sync.sh');
const macWhyNoChange = read('scripts/mac-why-no-change.sh');
const footgunBundledSync = /mac-build\.sh.*--bundled/.test(macCapSync.replace(/#.*$/gm, ''));
const footgunWhyBundled = /must be 0 for bundled app/.test(macWhyNoChange);

const localHasGuardScript = /hosted-runtime-guard\.js/.test(localIndex);
const unpublishedWebFixes =
  (localHasGuardScript && !liveHasGuardScript) ||
  (stripeInlineFixed && liveStripeInlineBroken) ||
  publishGaps.length > 0;

/** @type {{ id: string, category: string, title: string, applies: boolean, detail: string, fix?: string }[]} */
const scenarios = [
  {
    id: '1.1',
    category: 'Pipeline',
    title: 'Unpublished web fixes (git ahead of Base44 live)',
    applies: hosted && unpublishedWebFixes,
    detail:
      'Local repo has index.html / guard / wizard files not yet on live Base44. GitHub push alone does not update hosted WebView UI.',
    fix: 'bash scripts/base44-publish-wizard.sh → Publish once → node scripts/audit-base44-bundle.mjs',
  },
  {
    id: '1.2',
    category: 'Pipeline',
    title: 'Wrong git branch',
    applies: branch !== CANONICAL_BRANCH,
    detail: `Current branch: ${branch}. Fixes live on ${CANONICAL_BRANCH}.`,
    fix: `git checkout ${CANONICAL_BRANCH} && git pull`,
  },
  {
    id: '2.1',
    category: 'Mode',
    title: 'Bundled shell (capacitor://localhost) instead of hosted',
    applies: !hosted || bundledMode,
    detail: `server.url=${serverUrl || 'missing'} BUNDLED_MODE.txt=${bundledMode ? 'yes' : 'no'}`,
    fix: 'bash scripts/mac-build.sh --hosted --no-git (default is hosted)',
  },
  {
    id: '2.2',
    category: 'Mode',
    title: 'Footgun: mac-capacitor-web-sync.sh forces --bundled',
    applies: footgunBundledSync,
    detail: 'That script execs mac-build.sh --bundled — ignores Base44 Publish entirely.',
    fix: 'Use bash scripts/mac-build.sh (hosted) instead',
  },
  {
    id: '2.3',
    category: 'Mode',
    title: 'Footgun: mac-why-no-change.sh assumes bundled success criteria',
    applies: footgunWhyBundled,
    detail: 'Script says server.url must be 0 and expects capacitor://localhost badge.',
    fix: 'Use bash scripts/mac-diagnose-mobile.sh for hosted apps',
  },
  {
    id: '3.1',
    category: 'Base44 Publish',
    title: 'Partial Publish (index.html / meta only, stale JS bundle)',
    applies: liveDeploy === deploy && KNOWN_STALE.includes(liveBundle),
    detail: `Live bundle: ${liveBundle}`,
    fix: 'Paste ALL wizard files including JSX/JS libs, then Publish once',
  },
  {
    id: '3.2',
    category: 'Base44 Publish',
    title: 'Live deploy stamp behind git',
    applies: liveDeploy !== '?' && liveDeploy !== deploy,
    detail: `Live v${liveDeploy} vs git v${deploy}`,
    fix: 'Paste index.html + src/deploy-marker.js → Publish',
  },
  {
    id: '3.3',
    category: 'Base44 Publish',
    title: 'hosted-runtime-guard.js not published',
    applies: hosted && (!liveHasGuardScript || !guardIsJs),
    detail: `Script tag in live HTML: ${liveHasGuardScript}. File serves JS: ${guardIsJs}`,
    fix: 'Create public/hosted-runtime-guard.js in Base44 + add <script> in index.html → Publish',
  },
  {
    id: '3.4',
    category: 'Base44 Publish',
    title: 'index.html Stripe inline guard still broken on live',
    applies: hosted && stripeInlineFixed && liveStripeInlineBroken,
    detail:
      'Live intercept() returns true even when InAppBrowser.openInWebView fails — navigation blocked silently.',
    fix: 'Republish index.html (intercept must be: return openInApp(u))',
  },
  {
    id: '3.5',
    category: 'Base44 Publish',
    title: 'RuntimeDiagnostic / Account page not on live',
    applies:
      hosted &&
      !liveBundleBody.includes('RuntimeDiagnostic') &&
      existsSync('src/components/RuntimeDiagnostic.jsx'),
    detail: 'On-device diagnostics on Account page require Base44 Publish of Account.jsx + RuntimeDiagnostic.jsx',
    fix: 'Publish src/pages/Account.jsx and src/components/RuntimeDiagnostic.jsx',
  },
  {
    id: '3.6',
    category: 'Base44 Publish',
    title: 'Publish wizard missing new files (repo out of sync with checklist)',
    applies: publishGaps.length > 0,
    detail: publishGaps.map((g) => `${g.path} missing from ${g.src}`).join('; ') || 'none',
    fix: 'Pull latest branch — wizard lists all required paths',
  },
  {
    id: '4.1',
    category: 'Cache',
    title: 'WKWebView 7-day CDN cache on JS assets',
    applies: hosted,
    detail:
      'Base44 assets use long Cache-Control. Same native install + same BUILD_STAMP can keep old JS after Publish.',
    fix: 'New Xcode Run after BUILD_STAMP change; server.url has ?rb_native=v###; delete app before reinstall',
  },
  {
    id: '4.2',
    category: 'Cache',
    title: 'AppDelegate pendingCacheReload without WebView reload (native fix not installed)',
    applies: hosted && !hasCacheReloadFix,
    detail: 'Older native binary cleared cache but never called reloadFromOrigin.',
    fix: 'Pull branch, mac-build.sh --hosted, delete app, Xcode Clean → Run',
  },
  {
    id: '4.3',
    category: 'Cache',
    title: 'Base44 Publish without native rebuild (BUILD_STAMP unchanged)',
    applies: hosted,
    detail:
      'Web-side Publish updates live site but iPhone may keep cached JS until native BUILD_STAMP / CFBundleVersion changes.',
    fix: 'After Publish, touch BUILD_STAMP or bump build → mac-build.sh → Xcode Run',
  },
  {
    id: '5.1',
    category: 'Info',
    title: 'ios/public hash ≠ live bundle hash (looks like "no sync")',
    applies: false,
    detail:
      hosted &&
      existsSync('ios/App/App/public/index.html') &&
      liveBundle !== 'unknown'
        ? `EXPECTED in hosted mode — ios/public is shell fallback only; live is ${liveBundle}.`
        : 'N/A',
    fix: 'Compare Safari private tab vs native app, not ios/public vs live',
  },
  {
    id: '5.2',
    category: 'Native shell',
    title: 'stripe.com in allowNavigation (external browser for payments)',
    applies: stripeInNav,
    detail: 'Capacitor opens Stripe outside in-app WebView.',
    fix: 'mac-build.sh --hosted (use-local-native-bundle strips stripe.com)',
  },
  {
    id: '5.3',
    category: 'Native shell',
    title: 'Missing rb_native cache-bust on server.url',
    applies: hosted && !/rb_native=v\d+/.test(serverUrl),
    detail: `server.url=${serverUrl}`,
    fix: 'bash scripts/mac-build.sh --hosted',
  },
  {
    id: '6.1',
    category: 'Xcode / device',
    title: 'Xcode Run never completed / wrong app icon on home screen',
    applies: false,
    detail: 'Cannot verify from CI — audits pass but device may run old TestFlight or failed Run.',
    fix: 'Delete Restorebraine → Xcode Clean → Run → log must show Restorebraine DEPLOY OK',
  },
  {
    id: '6.2',
    category: 'Xcode / device',
    title: 'Opening TestFlight build instead of Xcode Run install',
    applies: false,
    detail: 'Two icons or old TestFlight binary lacks AppDelegate cache fixes.',
    fix: 'Use Xcode Run build; check purple overlay (Swift) top-right: shell https://restorebraine.base44.app',
  },
  {
    id: '7.1',
    category: 'Data / backend',
    title: 'claimOrphanedData server function not deployed in Base44',
    applies: false,
    detail:
      `Live bundle has claimOrphanedData client call: ${liveBundleBody.includes('claimOrphanedData')}. Backend deploy not curl-verifiable.`,
    fix: 'Confirm base44/functions/claimOrphanedData exists in Base44 Functions dashboard',
  },
  {
    id: '7.2',
    category: 'Data / backend',
    title: 'Pre-v294 folders without created_by (data model, not sync)',
    applies: false,
    detail: 'Reinstall cannot restore folders that were never tied to user email on server.',
    fix: 'Use claimOrphanedData after login; create new folders post-fix',
  },
  {
    id: '8.1',
    category: 'Harmonized (not applying)',
    title: 'Stale ghost bundle index-mlcqt5ef.js on live',
    applies: KNOWN_STALE.includes(liveBundle),
    detail: `Live: ${liveBundle}`,
  },
  {
    id: '8.2',
    category: 'Harmonized (not applying)',
    title: 'Live bundle missing folder/payment markers',
    applies:
      !liveBundleBody.includes('claimOrphanedData') ||
      !liveBundleBody.includes('data-rb-payment-modal'),
    detail: 'Markers checked in live JS bundle body',
  },
  {
    id: '8.3',
    category: 'Harmonized (not applying)',
    title: 'BUILD_NUMBER ≠ DEPLOY_BUILD in git',
    applies: build !== deploy,
    detail: `build v${build} deploy v${deploy}`,
    fix: 'node scripts/sync-build-numbers.mjs',
  },
];

const applying = scenarios.filter(
  (s) => s.applies && !s.category.startsWith('Harmonized') && s.category !== 'Info',
);
const info = scenarios.filter((s) => s.category === 'Info');
const harmonizedFails = scenarios.filter((s) => s.category.startsWith('Harmonized') && s.applies);
const manual = scenarios.filter((s) => s.id.startsWith('6.') || s.id.startsWith('7.'));

console.log('══════════════════════════════════════════════════════════════');
console.log('  CAPACITOR SYNC SCENARIO AUDIT — hosted wrapped app');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(`Branch: ${branch}  ·  Git v${deploy}  ·  Live v${liveDeploy}  ·  Mode: ${hosted ? 'HOSTED' : 'BUNDLED'}`);
console.log(`Live bundle: ${liveBundle}  ·  server.url: ${serverUrl || 'none'}\n`);

console.log('── APPLIES NOW (action required) ──');
if (applying.length === 0) {
  console.log('  (none detected from repo + live checks)\n');
} else {
  for (const s of applying) {
    console.log(`  [${s.id}] ${s.title}`);
    console.log(`       ${s.detail}`);
    if (s.fix) console.log(`       Fix: ${s.fix}`);
    console.log('');
  }
}

console.log('── INFO (often mistaken for bugs) ──');
for (const s of info) {
  console.log(`  [${s.id}] ${s.title}`);
  console.log(`       ${s.detail}`);
  console.log('');
}

console.log('── MANUAL / DEVICE (cannot auto-verify — often root cause) ──');
for (const s of manual) {
  console.log(`  [${s.id}] ${s.title}`);
  console.log(`       ${s.detail}`);
  if (s.fix) console.log(`       Fix: ${s.fix}`);
  console.log('');
}

console.log('── NOT APPLYING (harmonized) ──');
const notApplying = scenarios.filter(
  (s) => !s.applies && !s.category.startsWith('Harmonized'),
);
for (const s of notApplying.slice(0, 8)) {
  console.log(`  [${s.id}] ${s.title} — OK`);
}
if (harmonizedFails.length) {
  console.log('\n  REGRESSIONS (should not apply but DO):');
  harmonizedFails.forEach((s) => console.log(`    [${s.id}] ${s.title}`));
} else {
  console.log(`  Live markers, deploy stamp, ghost bundle — OK at v${deploy}`);
}
console.log('');

console.log('── HOSTED SYNC CHAIN (what must all succeed) ──');
console.log('  1. Paste ALL publish files → Base44 Publish (web UI)');
console.log('  2. bash scripts/mac-build.sh --hosted --no-git (native shell + BUILD_STAMP)');
console.log('  3. Delete app on iPhone → Xcode Clean → Run (DEPLOY OK in log)');
console.log('  4. Purple overlay: shell https://restorebraine.base44.app');
console.log('  5. Compare Safari private tab vs native — both should match live v' + deploy);
console.log('══════════════════════════════════════════════════════════════\n');

process.exit(harmonizedFails.length ? 1 : applying.some((s) => s.id.startsWith('3.')) ? 1 : 0);
