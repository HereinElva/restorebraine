/**
 * Full Capacitor iOS audit — run after build:native-local or when device shows "no change".
 * Usage: node scripts/capacitor-audit.mjs
 *        CAPACITOR_LOCAL=1 node scripts/capacitor-audit.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const isLocal = process.env.CAPACITOR_LOCAL === '1';
const repo = resolve(import.meta.dirname, '..');

const read = (rel) => {
  const p = resolve(repo, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

const hash = (rel) => {
  const p = resolve(repo, rel);
  if (!existsSync(p)) return null;
  return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
};

const warn = (msg) => console.warn(`WARN  ${msg}`);
const fail = (msg) => console.error(`FAIL  ${msg}`);
const ok = (msg) => console.log(`OK    ${msg}`);

let issues = 0;
const bump = () => {
  issues += 1;
};

console.log('=== Restorebraine Capacitor iOS Audit ===\n');

// 1. Mode flags
const modeSrc = read('src/lib/native-bundle-mode.js') ?? '';
const buildInfo = read('src/lib/build-info.js') ?? '';
const buildNum = buildInfo.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const localFlag = /LOCAL_NATIVE_BUNDLE = true/.test(modeSrc);
ok(`BUILD_NUMBER=${buildNum}, LOCAL_NATIVE_BUNDLE=${localFlag}`);

if (isLocal && !localFlag) {
  fail('CAPACITOR_LOCAL=1 but native-bundle-mode.js is false — run use-local-native-bundle.mjs --local');
  bump();
}

// 2. capacitor.config.json
for (const rel of ['capacitor.config.json', 'ios/App/App/capacitor.config.json']) {
  const content = read(rel);
  if (!content) {
    fail(`${rel} missing`);
    bump();
    continue;
  }
  const hasUrl = /"url"\s*:/.test(content);
  if (isLocal && hasUrl) {
    fail(`${rel} has server.url — device loads hosted site, NOT local bundle`);
    bump();
  } else if (!isLocal && !hasUrl) {
    warn(`${rel} has no server.url (native-local mode)`);
  } else if (hasUrl) {
    ok(`${rel} hosted mode (server.url set)`);
  } else {
    ok(`${rel} native-local (no server.url)`);
  }
}

// 3. dist vs ios/public
const distAssets = resolve(repo, 'dist/assets');
const iosAssets = resolve(repo, 'ios/App/App/public/assets');
if (!existsSync(distAssets) || !existsSync(iosAssets)) {
  fail('dist/assets or ios/App/App/public/assets missing — run npm run build:native-local');
  bump();
} else {
  const distFiles = new Set(readdirSync(distAssets));
  const iosFiles = new Set(readdirSync(iosAssets));
  const orphans = [...iosFiles].filter((f) => !distFiles.has(f));
  const missing = [...distFiles].filter((f) => !iosFiles.has(f));
  if (orphans.length) {
    fail(`ios/public/assets has ${orphans.length} orphan file(s) not in dist: ${orphans.slice(0, 4).join(', ')}`);
    bump();
  }
  if (missing.length) {
    fail(`ios/public/assets missing ${missing.length} file(s) from dist`);
    bump();
  }
  if (!orphans.length && !missing.length) {
    ok(`dist/assets and ios/public/assets identical (${distFiles.size} files)`);
  }

  const distIndex = read('dist/index.html') ?? '';
  const iosIndex = read('ios/App/App/public/index.html') ?? '';
  const entry = distIndex.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];
  if (entry) {
    ok(`Entry chunk: ${entry} (hash ${hash(`dist/assets/${entry}`)})`);
    if (!iosFiles.has(entry)) {
      fail(`index.html references ${entry} but missing from ios/public/assets`);
      bump();
    }
  }
}

// 4. BUILD_STAMP + Xcode version
const stamp = read('ios/App/App/BUILD_STAMP.txt')?.trim();
if (stamp) ok(`BUILD_STAMP: ${stamp}`);
else {
  warn('BUILD_STAMP.txt missing');
  bump();
}

const pbx = read('ios/App/App.xcodeproj/project.pbxproj') ?? '';
const xcodeVer = pbx.match(/CURRENT_PROJECT_VERSION = (\d+)/)?.[1];
if (xcodeVer && xcodeVer !== buildNum) {
  fail(`CURRENT_PROJECT_VERSION (${xcodeVer}) != BUILD_NUMBER (${buildNum}) — run write-build-info`);
  bump();
} else if (xcodeVer) {
  ok(`CURRENT_PROJECT_VERSION=${xcodeVer} matches BUILD_NUMBER`);
}

// 5. LOCAL_NATIVE_BUNDLE in bundles
if (existsSync(distAssets)) {
  const appChunk = readdirSync(distAssets).find((f) => f.startsWith('App-') && f.endsWith('.js'));
  const entryChunk = read('dist/index.html')?.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1];
  for (const [label, file] of [
    ['App chunk', appChunk],
    ['Entry chunk', entryChunk],
  ]) {
    if (!file) continue;
    const content = readFileSync(resolve(distAssets, file), 'utf8');
    if (/LOCAL_NATIVE_BUNDLE=!1|LOCAL_NATIVE_BUNDLE=false/.test(content)) {
      fail(`${label} ${file} has LOCAL_NATIVE_BUNDLE=false`);
      bump();
    } else if (/LOCAL_NATIVE_BUNDLE=!0|LOCAL_NATIVE_BUNDLE=true|ar=!0/.test(content)) {
      ok(`${label} ${file} has LOCAL_NATIVE_BUNDLE=true`);
    }
    if (isLocal && (label === 'App chunk' || (label === 'Entry chunk' && !appChunk))) {
      if (/Continue With Google|Continue with Apple|Sign In With Email|NativeLoginCard|data-rb-auth=sign-in-v4/.test(content)) {
        ok(`${label} ${file} has native login card (multi-provider)`);
      } else {
        fail(`${label} ${file} missing SignInScreen — old login bundle?`);
        bump();
      }
      if (/data:image\/png;base64,/.test(content)) {
        ok(`${label} ${file} has embedded logo data (splash/native fallback)`);
      } else {
        warn(`${label} ${file} has no embedded logo data — OK if login page has no logo`);
      }
    }
  }
}

// 6. Build v4 bridge in ios/public
const v4Bridge = read('ios/App/App/public/restorebraine-v4-bridge.js');
if (v4Bridge && v4Bridge.includes('__restorebraineSessionBridgeInstalled')) {
  ok(`restorebraine-v4-bridge.js in ios/public (${v4Bridge.length} bytes)`);
} else {
  fail('restorebraine-v4-bridge.js missing from ios/public — run build:native-local');
  bump();
}

const iosIndex = read('ios/App/App/public/index.html');
if (iosIndex && /restorebraine-v4-bridge\.js/.test(iosIndex)) {
  fail('index.html has sync v4-bridge script — causes white screen; bridge loads async in main.jsx');
  bump();
} else if (iosIndex) {
  ok('index.html has no sync v4-bridge (async load OK)');
}

for (const required of ['restorebraine-v4-bridge.js', 'v4-native-oauth.js']) {
  const iosPath = resolve(`ios/App/App/public/${required}`);
  if (existsSync(iosPath)) {
    ok(`${required} in ios/public (${readFileSync(iosPath).length} bytes)`);
  } else {
    fail(`${required} missing from ios/public — run npm run cap:merge-web-into-ios`);
    bump();
  }
}

const loginLogoPath = resolve('ios/App/App/public/login-logo.png');
const appIconPath = resolve('ios/App/App/public/AppIcon.png');
if (existsSync(loginLogoPath)) {
  const bytes = readFileSync(loginLogoPath).length;
  ok(`login-logo.png in ios/public (${bytes} bytes — optional legacy asset)`);
} else {
  ok('login-logo.png not in ios/public (OK — login has no logo)');
  bump();
}
if (existsSync(appIconPath)) {
  const bytes = readFileSync(appIconPath).length;
  ok(`AppIcon.png in ios/public (${bytes} bytes)`);
} else {
  warn('AppIcon.png missing from ios/public');
}

// 7. Git-tracked stale public risk
try {
  const { execSync } = await import('node:child_process');
  const tracked = execSync('git ls-files ios/App/App/public/', { cwd: repo, encoding: 'utf8' }).trim();
  if (tracked) {
    const count = tracked.split('\n').filter(Boolean).length;
    warn(`${count} file(s) in ios/App/App/public/ are git-tracked — git checkout can restore stale bundles`);
    warn('Run: bash scripts/mac-ios-native-rebuild.sh (do NOT git checkout public/ before npm build)');
  }
} catch {
  /* not a git repo */
}

// 7. Xcode folder reference note
console.log('\n--- Xcode deploy checklist ---');
console.log('1. bash scripts/mac-ios-native-rebuild.sh');
console.log('2. Xcode: delete app -> Clean Build Folder -> Run');
console.log('3. On device badge: v{N} · v4-core, origin capacitor://localhost');
console.log('4. Expanded badge shows entry chunk name (proves loaded JS)');
console.log('5. After Run, verify installed .app:');
console.log('   APP=$(find ~/Library/Developer/Xcode/DerivedData -name App.app -path "*-iphoneos/*" | head -1)');
console.log('   cat "$APP/BUILD_STAMP.txt"');
console.log('   grep script "$APP/public/index.html"');

console.log(`\n=== Audit complete: ${issues} issue(s) ===`);
if (issues) process.exit(1);
