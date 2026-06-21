/**
 * Static checks for auth flow: login card, logout, gallery nav, session persistence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve('.');
const read = (rel) => readFileSync(resolve(repo, rel), 'utf8');

let fail = 0;
const ok = (msg) => console.log(`OK: ${msg}`);
const bad = (msg) => {
  console.error(`FAIL: ${msg}`);
  fail += 1;
};

console.log('=== Auth flow verification ===\n');

const signIn = read('src/screens/SignInScreen.jsx');
if (/useEffect[\s\S]*!isNativeShell\(\)[\s\S]*navigateToLogin/.test(signIn)) {
  bad('SignInScreen must not auto-redirect web to platform login');
} else {
  ok('SignInScreen shows NativeLoginCard on web + bundled native');
}

if (!signIn.includes('NativeLoginCard')) {
  bad('SignInScreen missing NativeLoginCard');
} else {
  ok('SignInScreen imports NativeLoginCard');
}

const card = read('src/components/NativeLoginCard.jsx');
for (const label of ['Continue With Google', 'Continue With Apple', 'Sign In With Email']) {
  if (!card.includes(label)) bad(`NativeLoginCard missing "${label}"`);
}
if (!card.includes('data-rb-provider')) bad('NativeLoginCard missing data-rb-provider on OAuth buttons');
else ok('NativeLoginCard OAuth buttons have data-rb-provider');
if (fail === 0 || card.includes('Continue With Google')) {
  ok('NativeLoginCard has Google, Apple, email options');
}

const v4oauth = existsSync('public/v4-native-oauth.js') ? read('public/v4-native-oauth.js') : '';
if (v4oauth.includes('__restorebraineNativeOAuthTapBackup')) {
  bad('v4-native-oauth.js must not install capture-phase tap backup (double-fires with React onClick)');
} else if (v4oauth.includes('data-rb-provider') || v4oauth.includes('__restorebraineNativeOAuth')) {
  ok('v4-native-oauth.js token helpers only — React owns login taps');
}

const oauthJs = read('src/lib/native-google-oauth.js');
if (oauthJs.includes('RestorebraineOAuth') && oauthJs.includes('Browser.open')) {
  ok('native-google-oauth uses registerPlugin + Browser fallback');
} else {
  bad('native-google-oauth missing registerPlugin or Browser fallback');
}
if (oauthJs.includes('oauthListenerAttachPromise') && !/oauthListenerAttached = true;\s*\n\s*const ib = await getInAppBrowserPluginAsync/.test(oauthJs)) {
  ok('OAuth listeners attach after InAppBrowser ready (no poisoned flag)');
} else {
  bad('OAuth listener attach may poison oauthListenerAttached before plugin ready');
}
if (oauthJs.includes('openInWebView({ url: normalizedUrl') && !oauthJs.includes('await ib.openInWebView({ url: normalizedUrl')) {
  ok('Bundled WebView open is non-blocking (button resets after sheet opens)');
} else {
  bad('openInWebView is still awaited — login button will stick on Opening Google');
}

const pbx = existsSync('ios/App/App.xcodeproj/project.pbxproj') ? read('ios/App/App.xcodeproj/project.pbxproj') : '';
if (pbx.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements')) {
  ok('Xcode links App.entitlements (universal links / webcredentials)');
} else {
  bad('App.entitlements not linked in Xcode — OAuth universal-link fallback disabled');
}

const rootCap = existsSync('capacitor.config.json') ? read('capacitor.config.json') : '';
if (rootCap.includes('InAppBrowserPlugin')) {
  ok('Root capacitor.config.json registers InAppBrowserPlugin');
} else {
  bad('Root capacitor.config.json missing InAppBrowserPlugin');
}

if (oauthJs.includes('LOCAL_NATIVE_BUNDLE') && oauthJs.includes('openOAuthInWebView')) {
  ok('Bundled native uses in-app WebView for OAuth (no Base44 system popup)');
} else if (oauthJs.includes('LOCAL_NATIVE_BUNDLE') && oauthJs.includes('openBundledNativeOAuth')) {
  ok('Bundled native has openBundledNativeOAuth entry path');
} else {
  bad('Bundled native missing OAuth entry path');
}

const account = read('src/pages/Account.jsx');
if (!account.includes('data-rb-gallery-nav')) bad('Account Back to Gallery missing data-rb-gallery-nav');
else ok('Account Back to Gallery has data-rb-gallery-nav');

if (account.includes('__restorebrainePerformSignOut')) {
  bad('Account must not call __restorebrainePerformSignOut (only explicit Sign Out button)');
} else {
  ok('Account logout only via localLogout/logout');
}

const auth = read('src/lib/AuthContext.jsx');
if (!auth.includes('setManuallyLoggedOut(false)') || !auth.includes('restorebraine-session-updated')) {
  bad('AuthContext must clear manuallyLoggedOut on session-updated');
} else {
  ok('AuthContext clears manual logout when session returns');
}

const bridge = existsSync('public/restorebraine-v4-bridge.js') ? read('public/restorebraine-v4-bridge.js') : '';
if (bridge.includes('openLoginInWebView') && bridge.includes('isBundledNativeOrigin()')) {
  ok('Bridge uses in-app WebView for bundled OAuth (no Base44 system popup)');
} else if (bridge) {
  bad('Bridge missing in-app WebView path for bundled OAuth');
}

console.log('');
if (fail) {
  console.error(`=== Auth flow check: ${fail} issue(s) ===`);
  process.exit(1);
}
console.log('=== Auth flow check: all OK ===');
