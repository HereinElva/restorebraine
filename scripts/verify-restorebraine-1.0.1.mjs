/**
 * Restorebraine 1.0.1 — verify all required features are present in git source.
 * Run before every iPhone build.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const repo = resolve('.');
let fail = 0;

function read(path) {
  return readFileSync(resolve(repo, path), 'utf8');
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function failMsg(msg) {
  console.error(`FAIL: ${msg}`);
  fail += 1;
}

function mustInclude(file, pattern, label) {
  const content = read(file);
  const hit = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (hit) ok(`${label} (${file})`);
  else failMsg(`${label} missing in ${file}`);
}

console.log('=== Restorebraine 1.0.1 feature check ===\n');

// Version
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
if (/MARKETING_VERSION = 1\.0\.1/.test(pbx)) ok('MARKETING_VERSION 1.0.1');
else failMsg('MARKETING_VERSION must be 1.0.1');

const buildNum = read('src/lib/build-info.js').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const deploy = read('src/deploy-marker.js').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';
console.log(`Build: v${buildNum} · deploy v${deploy}\n`);

// Omega gallery (4 folder tab buttons)
mustInclude('src/components/gallery/MobileGallery.jsx', 'OrganizeButton', 'Organize button');
mustInclude('src/components/gallery/MobileGallery.jsx', 'CustomFolderButton', 'Custom folder button');
mustInclude('src/components/gallery/MobileGallery.jsx', 'DuplicateDetector', 'Duplicate detector button');
mustInclude('src/components/gallery/MobileGallery.jsx', 'data-rb-folder-action="select"', 'Select button');
mustInclude('src/components/gallery/folderActionStyles.js', 'SQUARE_FOLDER_ACTION_CLASS', 'Folder tile styles');

// Back to Gallery (no sign-out)
mustInclude('src/pages/Account.jsx', 'data-rb-gallery-nav', 'Back to Gallery nav marker');
mustInclude('src/pages/Account.jsx', 'navigateToGalleryFromAccount', 'Back to Gallery handler');
mustInclude('src/lib/gallery-nav.js', 'resumeActiveSession', 'Session resume on gallery nav');

// Sign out only via button
mustInclude('src/pages/Account.jsx', 'data-rb-sign-out-row', 'Sign out row marker');
mustInclude('src/lib/AuthContext.jsx', 'manuallyLoggedOut', 'Manual logout flag');
mustInclude('src/lib/AuthContext.jsx', 'localLogout', 'Native local logout');
mustInclude('src/lib/AuthContext.jsx', 'resumeActiveSession', 'Resume session helper');

// Stay logged in unless sign out
mustInclude('src/lib/session-bootstrap.js', 'installNativeSessionPersistence', 'Native session persistence');
mustInclude('src/lib/session-bootstrap.js', 'persistSessionToNativeStorage', 'Token persistence');
mustInclude('src/main.jsx', 'installNativeSessionPersistence', 'Boot-time session install');

// Login — all providers
mustInclude('src/components/NativeLoginCard.jsx', 'Continue With Google', 'Google login');
mustInclude('src/components/NativeLoginCard.jsx', 'SignInWithAppleButton', 'Apple HIG login button');
mustInclude('src/components/SignInWithAppleButton.jsx', 'Sign in with Apple', 'Apple HIG label');
mustInclude('src/components/AppleLogo.jsx', 'data-rb-apple-logo', 'Apple logo mark');
mustInclude('src/components/NativeLoginCard.jsx', 'Continue With Microsoft', 'Microsoft login');
mustInclude('src/screens/SignInScreen.jsx', 'NativeLoginCard', 'SignIn uses NativeLoginCard');

// Launch screen
for (const f of [
  'scripts/generate-ios-launch-screen.mjs',
  'ios/App/App/Base.lproj/LaunchScreen.storyboard',
]) {
  if (existsSync(resolve(repo, f))) ok(`Launch screen asset: ${f}`);
  else failMsg(`Missing ${f}`);
}

const plist = read('ios/App/App/Info.plist');
if (plist.includes('NSPhotoLibraryUsageDescription')) ok('Info.plist NSPhotoLibraryUsageDescription');
else failMsg('Info.plist missing NSPhotoLibraryUsageDescription (iOS upload)');
if (plist.includes('NSMicrophoneUsageDescription')) ok('Info.plist NSMicrophoneUsageDescription');
else failMsg('Info.plist missing NSMicrophoneUsageDescription (iOS video upload)');

// Xcode full replace
mustInclude('scripts/xcode-copy-public-bundle.sh', 'rm -rf "$DEST_PUBLIC"', 'Xcode rm -rf public replace');
mustInclude('scripts/xcode-copy-public-bundle.sh', 'ditto', 'Xcode ditto full copy');
mustInclude('ios/App/App.xcodeproj/project.pbxproj', 'xcode-copy-public-bundle.sh', 'Xcode copy build phase');

console.log('');
if (fail) {
  console.error(`=== 1.0.1 check: ${fail} issue(s) ===`);
  process.exit(1);
}
console.log('=== 1.0.1 check: all features present ===');
