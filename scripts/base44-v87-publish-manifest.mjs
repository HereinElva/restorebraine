/**
 * v87 Base44 publish manifest — complete wipe of post-v87 live JS.
 * Partial publish (HTML only, static JS only) left stale index-*.js bundles.
 * For a full nuke, paste TIER_FULL before clicking Publish.
 */
export const V87_TIP = 'f1b2505';
export const HOSTED = 'https://restorebraine.base44.app';

/** Must paste first — fixes Sign In OAuth (live index-CLtZjYMv.js blocker) */
export const TIER_OAUTH = [
  'src/lib/app-domains.js',
  'src/lib/native-platform-guard.js',
  'src/lib/native-google-oauth.js',
  'src/lib/auth-urls.js',
  'src/lib/native-hosted-redirect.js',
  'src/lib/session-bootstrap.js',
  'src/lib/native-oauth-fix.js',
  'src/lib/AuthContext.jsx',
];

/** App shell — signed-out UI + login routing */
export const TIER_APP_SHELL = [
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'src/Layout.jsx',
  'src/components/auth/SignedOutLanding.jsx',
  'public/native-oauth-return.js',
  'public/login-redirect.js',
  'src/deploy-marker.js',
  'src/lib/build-info.js',
];

/** Full hosted app — publish all to replace every stale chunk on Base44 */
export const TIER_FULL = [
  'index.html',
  'public/login-redirect.js',
  'public/native-oauth-return.js',
  ...TIER_OAUTH.filter((f) => !TIER_APP_SHELL.includes(f)),
  'src/main.jsx',
  'src/App.jsx',
  'src/App.css',
  'src/index.css',
  'src/Layout.jsx',
  'src/pages.config.js',
  'src/deploy-marker.js',
  'src/lib/build-info.js',
  'src/components/auth/SignedOutLanding.jsx',
  'src/pages/Gallery.jsx',
  'src/pages/Upload.jsx',
  'src/pages/Account.jsx',
  'src/pages/Home.jsx',
  'src/pages/PrivacyPolicy.jsx',
  'src/pages/PaymentSuccess.jsx',
  'src/components/gallery/MobileGallery.jsx',
  'src/components/gallery/EmptyState.jsx',
  'src/components/gallery/FolderView.jsx',
  'src/components/gallery/OrganizeButton.jsx',
  'src/components/gallery/folderActionStyles.js',
  'src/components/upload/MobileUpload.jsx',
  'src/components/upload/AiUploadConsentModal.jsx',
  'src/api/base44Client.js',
  'src/lib/ai-upload-consent.js',
  'src/lib/gallery-nav.js',
  'src/lib/native-media-input.js',
  'src/lib/media-upload.js',
  'src/lib/upload-pipeline.js',
  'src/lib/app-params.js',
  'src/lib/capacitor-ready.js',
  'src/lib/persistentStorage.js',
  'src/lib/forceLogout.js',
];

/** Post-v87 artifacts — must NOT exist in git OR live Base44 after nuke */
export const POST_V87_FORBIDDEN = [
  { pattern: 'NativeLoginCard', label: 'v164+ bundled login card' },
  { pattern: 'SignInScreen', label: 'v123–v160 login rewrite' },
  { pattern: 'from \'@/pages/LoginPage\'', label: 'v151 dedicated login page import' },
  { pattern: 'NativeLoginProviders', label: 'v155 in-app providers experiment' },
  { pattern: 'NativePlatformLoginRedirect', label: 'v146 platform login redirect' },
  { pattern: 'native-shell-stabilizer', label: 'v157 flicker stabilizer' },
  { pattern: 'RestorebraineBridgeViewController', label: 'v4-core custom bridge VC' },
  { pattern: 'RestorebraineNativePlugin', label: 'v92+ native plugin era' },
  { pattern: '__rbUserInitiatedLogin', label: 'v155 gesture gate OAuth' },
  { pattern: 'LOCAL_NATIVE_BUNDLE', label: 'v89 bundled mode flag in production' },
];

export const POST_V87_FORBIDDEN_PATHS = [
  'scripts/reset-to-v87.sh',
  'scripts/nuclear-rebuild.sh',
  'public/native-shell-stabilizer.js',
  'ios/App/App/RestorebraineBridgeViewController.swift',
  'src/components/auth/NativeLoginCard.jsx',
  'src/components/auth/SignInScreen.jsx',
  'src/pages/LoginPage.jsx',
  'src/lib/native-shell-stabilizer.js',
];

export const CAPACITOR_LINGERING_DIRS = [
  'dist',
  'ios/App/App/public',
  'ios/App/Pods',
  'ios/App/build',
  'ios/App/Podfile.lock',
  'node_modules/.vite',
];
