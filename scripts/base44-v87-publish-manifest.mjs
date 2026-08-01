/**
 * v87 Base44 publish manifest — complete wipe of post-v87 live JS.
 * Partial publish (HTML only, OAuth only, or gallery without deps) left stale App-*.js.
 *
 * Reference lineage: omega-3 (v261 gallery/organize) → hosted fixes → v87 (f1b2505).
 * See docs/V87-FROM-OMEGA3.md and npm run omega:v87-ref
 */
export const V87_TIP = 'f1b2505';
export const OMEGA3_TAG = 'omega-3';
export const OMEGA3_COMMIT = 'f58a80d';
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

/**
 * Gallery stack from Omega 3 (v261) — preserved through v87.
 * Missing any of these → App chunk keeps stale gallery/CSS (mixed publish).
 */
export const TIER_GALLERY = [
  'src/pages/Gallery.jsx',
  'src/components/gallery/MobileGallery.jsx',
  'src/components/gallery/EmptyState.jsx',
  'src/components/gallery/FolderView.jsx',
  'src/components/gallery/OrganizeButton.jsx',
  'src/components/gallery/folderActionStyles.js',
  'src/components/gallery/PullToRefresh.jsx',
  'src/components/gallery/CustomFolderButton.jsx',
  'src/components/gallery/DuplicateDetector.jsx',
  'src/components/gallery/FolderGrid.jsx',
  'src/components/gallery/MobileDrawerMenu.jsx',
  'src/components/gallery/MobileFolderCard.jsx',
  'src/components/gallery/MobilePhotoModal.jsx',
  'src/components/gallery/PhotoGrid.jsx',
  'src/components/gallery/PhotoModal.jsx',
  'src/components/gallery/SelectablePhotoGrid.jsx',
  'src/components/gallery/SelectionToolbar.jsx',
  'src/components/gallery/mobile-gallery-layout.css',
];

/** Shared app context (Gallery + Layout depend on these) */
export const TIER_CONTEXT = [
  'src/components/NavigationContext.jsx',
  'src/components/TabStateContext.jsx',
];

/** Upload page deps (Omega 3 upload pipeline) */
export const TIER_UPLOAD = [
  'src/pages/Upload.jsx',
  'src/components/upload/MobileUpload.jsx',
  'src/components/upload/AiUploadConsentModal.jsx',
  'src/components/upload/UploadZone.jsx',
  'src/components/upload/PaymentModal.jsx',
];

/** Media / organize libs (Omega 3 organize persistence + multi-batch) */
export const TIER_LIB_MEDIA = [
  'src/lib/media-organize.js',
  'src/lib/gallery-organize-snapshot.js',
  'src/lib/run-media-organize.js',
  'src/lib/folder-membership.js',
  'src/lib/folder-membership-cache.js',
  'src/lib/gallery-query-keys.js',
  'src/lib/gallery-data.js',
  'src/lib/scroll-reset.js',
  'src/lib/media-analysis.js',
  'src/lib/media-tags.js',
  'src/lib/media-search.js',
  'src/lib/media-constants.js',
  'src/lib/invoke-llm-retry.js',
  'src/lib/ai-upload-consent.js',
  'src/lib/media-upload.js',
  'src/lib/upload-pipeline.js',
  'src/lib/native-media-input.js',
  'src/lib/stripe-checkout.js',
  'src/lib/in-app-purchase.js',
  'src/lib/storage-billing.js',
  'src/lib/concurrency.js',
];

/** Utils + hooks imported by gallery/upload pages */
export const TIER_UTILS = [
  'src/utils/index.ts',
  'src/lib/utils.js',
  'src/hooks/use-mobile.jsx',
];

/** Full hosted app — publish ALL before clicking Publish once */
export const TIER_FULL = [
  ...new Set([
    ...TIER_APP_SHELL,
    ...TIER_OAUTH.filter((f) => !TIER_APP_SHELL.includes(f)),
    ...TIER_GALLERY,
    ...TIER_CONTEXT,
    ...TIER_UPLOAD,
    ...TIER_LIB_MEDIA,
    ...TIER_UTILS,
    'src/App.css',
    'src/index.css',
    'src/pages.config.js',
    'src/pages/Account.jsx',
    'src/pages/Home.jsx',
    'src/pages/PrivacyPolicy.jsx',
    'src/pages/PaymentSuccess.jsx',
    'src/api/base44Client.js',
    'src/lib/gallery-nav.js',
    'src/lib/app-params.js',
    'src/lib/capacitor-ready.js',
    'src/lib/persistentStorage.js',
    'src/lib/forceLogout.js',
  ]),
];

/** Files user already pasted clean into Base44 (skip in remaining paste list) */
export const BASE44_ALREADY_SAVED = [
  'index.html',
  'src/lib/native-platform-guard.js',
  'src/lib/auth-urls.js',
  'src/lib/native-google-oauth.js',
  'src/lib/AuthContext.jsx',
  'src/App.jsx',
  'src/components/auth/SignedOutLanding.jsx',
];

export const BASE44_REMAINING = TIER_FULL.filter((f) => !BASE44_ALREADY_SAVED.includes(f));

export const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/HereinElva/restorebraine/cursor/apple-privacy-plist-bacf';

/** Raw source URL — NOT .txt batch wrappers (Base44 markdown fetch mangles JSX) */
export function githubRawUrl(relPath) {
  return `${GITHUB_RAW_BASE}/${relPath}`;
}

export const POST_V87_FORBIDDEN = [
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

/** Commits from omega-3 → v87 (hosted + login corrections) */
export const OMEGA3_TO_V87_COMMITS = [
  { sha: '17af6de', note: 'App Store privacy plist (5.1.1)' },
  { sha: '6c15e97', note: 'v82 compact AI consent + fast upload' },
  { sha: '390928b', note: 'v83 native-media-input for iOS upload picker' },
  { sha: '698975e', note: 'Restore hosted Capacitor — OAuth + session persistence' },
  { sha: '5762b16', note: 'v87 UI — SignedOutLanding Find Your Memories + Sign In' },
  { sha: 'f1b2505', note: 'v87 tip — OAuth on restorebraine.base44.app (not app.base44.com 404)' },
];
