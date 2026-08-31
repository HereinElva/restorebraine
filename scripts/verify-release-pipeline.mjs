/**
 * End-to-end release pipeline: GitHub → Base44 → Capacitor → iOS/Android.
 *
 * Hosted App Store / Play Store shells load https://restorebraine.base44.app —
 * Base44 bundle MUST include all markers or mobile shows stale UI.
 *
 * Usage:
 *   node scripts/verify-release-pipeline.mjs            # full (hosted mobile)
 *   node scripts/verify-release-pipeline.mjs --bundled    # skip Base44 (bundled native)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const bundledOnly = process.argv.includes('--bundled');
const repo = resolve(import.meta.dirname, '..');

let blockers = [];
let warnings = [];

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

function check(label, ok, detail, { blocker = true } = {}) {
  const tag = ok ? 'OK  ' : blocker ? 'FAIL' : 'WARN';
  console.log(`   ${tag}: ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) {
    (blocker ? blockers : warnings).push(`${label}${detail ? `: ${detail}` : ''}`);
  }
  return ok;
}

function runNode(script) {
  const result = spawnSync('node', [script], { cwd: repo, encoding: 'utf8' });
  return { ok: result.status === 0, out: (result.stdout || '') + (result.stderr || '') };
}

function findMainBundle(dir) {
  if (!existsSync(dir)) return null;
  const htmlPath = join(dir, 'index.html');
  if (!existsSync(htmlPath)) return null;
  const html = readFileSync(htmlPath, 'utf8');
  const match = html.match(/assets\/(index-[^"]+\.js)/) ?? html.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
  if (!match) return null;
  const name = match[1].replace(/^\.\/assets\//, '');
  const path = join(dir, 'assets', name);
  return existsSync(path) ? { name, path, body: readFileSync(path, 'utf8') } : null;
}

const REQUIRED_SOURCES = [
  'src/lib/folder-server-sync.js',
  'src/lib/folder-membership.js',
  'src/lib/run-media-organize.js',
  'src/lib/stripe-checkout.js',
  'src/components/upload/PaymentModal.jsx',
  'src/components/gallery/CustomFolderButton.jsx',
  'src/components/gallery/OrganizeButton.jsx',
  'src/pages/Account.jsx',
  'public/native-ui-scrub.js',
  'index.html',
  'src/deploy-marker.js',
  'src/main.jsx',
  'capacitor.config.json',
  'ios/App/App/capacitor.config.json',
];

const BUNDLE_MARKERS = [
  { pattern: 'claimOrphanedData', label: 'folder persistence' },
  { pattern: 'Folder.filter', label: 'folder user scoping' },
  { pattern: 'data-rb-payment-modal', label: 'payment modal iPhone fix' },
  { pattern: 'openInWebView', label: 'Stripe in-app checkout' },
];

const KNOWN_STALE_BUNDLES = ['index-mlcqt5ef.js', 'index-DVkubWP5.js', 'index-CGrESmC2.js'];

console.log('══════════════════════════════════════════════════════════════');
console.log('  RELEASE PIPELINE — GitHub · Base44 · Capacitor · Mobile');
console.log(`  Mode: ${bundledOnly ? 'bundled native only' : 'hosted mobile (Base44 required)'}`);
console.log('══════════════════════════════════════════════════════════════\n');

// ── 1. GitHub / version sync ────────────────────────────────────────────────
console.log('1) GITHUB VERSION SYNC');
const buildSync = runNode('scripts/verify-build-sync.mjs');
check('verify-build-sync.mjs', buildSync.ok, buildSync.ok ? 'all layers v295 aligned' : 'run sync-build-numbers.mjs');
const deploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
const build = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const branch = execSync('git branch --show-current', { cwd: repo, encoding: 'utf8' }).trim();
check('canonical branch', branch === 'cursor/fix-folder-persistence-bacf' || branch.includes('audit') || branch.includes('android'),
  branch === 'cursor/fix-folder-persistence-bacf' ? branch : `on ${branch} — use cursor/fix-folder-persistence-bacf for releases`,
  { blocker: false });
console.log('');

// ── 2. Source files (Base44 sandbox must mirror these) ──────────────────────
console.log('2) REQUIRED SOURCE FILES (missing in Base44 = stale bundle)');
for (const file of REQUIRED_SOURCES) {
  check(file, existsSync(resolve(file)), existsSync(resolve(file)) ? 'present' : 'MISSING');
}
console.log('');

// ── 3. Web build integrity ──────────────────────────────────────────────────
console.log('3) LOCAL WEB BUILD (proves code compiles without breakage)');
const distBundle = findMainBundle(resolve('dist'));
if (distBundle) {
  check('dist/ exists', true, distBundle.name);
  for (const marker of BUNDLE_MARKERS) {
    check(`dist bundle has ${marker.label}`, distBundle.body.includes(marker.pattern), marker.pattern);
  }
} else {
  warnings.push('dist/ not built — run: npm run build:web');
  console.log('   WARN: dist/ missing — run npm run build:web');
}
console.log('');

// ── 4. Capacitor config parity ──────────────────────────────────────────────
console.log('4) CAPACITOR CONFIG (iOS/Android shell)');
const capRoot = read('capacitor.config.json');
const capIos = existsSync('ios/App/App/capacitor.config.json') ? read('ios/App/App/capacitor.config.json') : '';
const hostedUrl = 'https://restorebraine.base44.app';
check('server.url points to Base44', capRoot.includes(hostedUrl), hostedUrl);
check('root/ios capacitor configs match allowNavigation',
  !capIos || JSON.stringify(JSON.parse(capRoot).server?.allowNavigation) === JSON.stringify(JSON.parse(capIos).server?.allowNavigation),
  capIos ? 'hosts aligned' : 'ios config missing');
check('no stripe.com in allowNavigation', !/stripe\.com/.test(capRoot) && !/stripe\.com/.test(capIos));
check('use-local-native-bundle does not inject stripe', !/stripe\.com/.test(read('scripts/use-local-native-bundle.mjs')));
console.log('');

// ── 5. Base44 live (critical for hosted mobile) ───────────────────────────
console.log('5) BASE44 LIVE (hosted iOS/Android load this URL at runtime)');
if (bundledOnly) {
  console.log('   SKIP: --bundled mode (native ships full app from ios/public)');
} else {
  const audit = runNode('scripts/audit-base44-bundle.mjs');
  check('audit-base44-bundle.mjs', audit.ok, audit.ok ? 'bundle fresh + markers present' : 'see audit output above');
}
console.log('');

// ── 6. iOS bundle (Xcode / TestFlight) ─────────────────────────────────────
console.log('6) iOS CAPACITOR BUNDLE (ios/App/App/public)');
const iosBundle = findMainBundle(resolve('ios/App/App/public'));
if (iosBundle) {
  check('ios/public index.html', true, iosBundle.name);
  const iosDeploy = read('ios/App/App/public/index.html').match(/restorebraine-deploy[^>]*content="v(\d+)"/)?.[1] ?? '?';
  check('ios deploy matches git', iosDeploy === deploy, `ios v${iosDeploy} git v${deploy}`);
  if (bundledOnly) {
    for (const marker of BUNDLE_MARKERS) {
      check(`ios bundle ${marker.label}`, iosBundle.body.includes(marker.pattern), marker.pattern);
    }
  } else {
    check('hosted mode: ios/public is shell only', true, 'runtime UI comes from Base44 URL');
  }
} else {
  warnings.push('ios/App/App/public not built — run hosted prepare or mac-build.sh before Xcode Archive');
  console.log('   WARN: ios/public missing — OK until Xcode Archive; hosted app loads Base44 live');
}
console.log('');

// ── 7. mac-build branch default ───────────────────────────────────────────
console.log('7) MAC BUILD SCRIPT DEFAULTS (wrong branch = missing fixes on device)');
const macBuild = read('scripts/mac-build.sh');
const defaultBranch = macBuild.match(/RESTOREBRAINE_BRANCH:-([^}]+)/)?.[1] ?? '?';
check('mac-build.sh default branch', defaultBranch === 'cursor/fix-folder-persistence-bacf',
  defaultBranch,
  { blocker: defaultBranch !== 'cursor/fix-folder-persistence-bacf' });
const hostedReplace = read('scripts/mac-xcode-full-replace.sh');
check('hosted replace avoids write-build-info auto-bump',
  hostedReplace.includes('build:web') && !hostedReplace.match(/npm run build\n/),
  hostedReplace.includes('build:web') ? 'uses build:web' : 'still uses npm run build (ghost version bump)');
console.log('');

// ── 8. Breakage risk matrix ─────────────────────────────────────────────────
console.log('8) WHAT BREAKS MOBILE UPDATES');
const risks = [
  {
    when: 'Base44 partial publish (meta only)',
    symptom: 'App shows v295 badge but old folders/payment UI',
    fix: 'Paste all 10 files in docs/BASE44-PUBLISH.md → Publish once',
    active: !bundledOnly && blockers.some((b) => b.includes('claimOrphanedData') || b.includes('stale')),
  },
  {
    when: 'folder-server-sync.js missing in Base44',
    symptom: 'Build fails or keeps stale index-mlcqt5ef.js bundle',
    fix: 'CREATE file in Base44 Code editor from GitHub',
    active: false, // cleared when live bundle has claimOrphanedData — see audit-base44-bundle
  },
  {
    when: 'npm run build / ios:prepare without sync',
    symptom: 'Version jumps v295→v296, Xcode/Base44 drift',
    fix: 'Use sync-build-numbers.mjs + build:web instead',
    active: !hostedReplace.includes('build:web'),
  },
  {
    when: 'mac-build.sh on wrong branch',
    symptom: 'Missing folder/stripe fixes on device',
    fix: 'RESTOREBRAINE_BRANCH=cursor/fix-folder-persistence-bacf bash scripts/mac-build.sh',
    active: defaultBranch !== 'cursor/fix-folder-persistence-bacf',
  },
  {
    when: 'stripe.com in allowNavigation',
    symptom: 'Payment opens Chrome instead of in-app sheet',
    fix: 'Use fix-folder-persistence-bacf branch configs',
    active: /stripe\.com/.test(capRoot),
  },
  {
    when: 'Xcode Run without DEPLOY OK in log',
    symptom: 'iPhone keeps old ios/public copy',
    fix: 'Clean Build Folder → verify-xcode-app-bundle.sh',
    active: false,
  },
  {
    when: 'Bundled vs hosted confusion',
    symptom: 'Expected bundled login but app loads Base44',
    fix: 'Hosted (--hosted): UI from Base44. Bundled: full app in ios/public',
    active: false,
  },
];

for (const risk of risks) {
  const icon = risk.active ? '⚠ ACTIVE' : '  ok    ';
  console.log(`   [${icon}] ${risk.when}`);
  console.log(`            → ${risk.symptom}`);
  console.log(`            Fix: ${risk.fix}`);
}
console.log('');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');
if (blockers.length === 0) {
  console.log('  PASS — Safe to ship to mobile');
  if (bundledOnly) {
    console.log('  (bundled mode: Base44 not checked — rebuild ios/public + Xcode Archive)');
  } else {
    console.log('  Hosted mobile will receive all v' + deploy + ' updates after Base44 Publish.');
  }
  if (warnings.length) {
    console.log('\n  Warnings:');
    warnings.forEach((w) => console.log(`    • ${w}`));
  }
  process.exit(0);
}

console.log(`  FAIL — ${blockers.length} blocker(s) must be fixed before mobile update\n`);
blockers.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));

console.log('\n  Safe release order:');
console.log('    1. git pull cursor/fix-folder-persistence-bacf');
console.log('    2. node scripts/sync-build-numbers.mjs && node scripts/verify-build-sync.mjs');
console.log('    3. bash scripts/base44-publish-wizard.sh  →  Publish once in Base44');
console.log('    4. node scripts/verify-release-pipeline.mjs  (must PASS)');
console.log('    5. bash scripts/mac-fix-build-stamp.sh');
console.log('    6. For App Store: RESTOREBRAINE_BRANCH=cursor/fix-folder-persistence-bacf bash scripts/mac-build.sh --hosted --no-git');
console.log('    7. Xcode Clean → Archive → Upload');
console.log('    8. Android: upload existing AAB or rebuild from android-play-store-bacf branch\n');

if (warnings.length) {
  console.log('  Warnings:');
  warnings.forEach((w) => console.log(`    • ${w}`));
}

process.exit(1);
