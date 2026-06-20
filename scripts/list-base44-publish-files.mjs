/**
 * Lists every source file that must be pasted into the Base44 Code editor
 * before clicking Publish. GitHub pushes alone do NOT update the live app.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deployBuild =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';

const PUBLISH_FILES = [
  // Boot + error UI
  'index.html',
  'public/login-redirect.js',
  'src/main.jsx',
  'src/deploy-marker.js',
  // Auth fixes (Base44 support: broken base44.app/login + iPhone deep-link)
  'src/lib/app-params.js',
  'src/lib/app-domains.js',
  'src/lib/auth-urls.js',
  'src/lib/AuthContext.jsx',
  'src/api/base44Client.js',
  'src/App.jsx',
  'src/lib/native-hosted-redirect.js',
  'src/lib/native-oauth-fix.js',
  'src/lib/native-platform-guard.js',
  'src/lib/native-google-oauth.js',
  'src/lib/session-bootstrap.js',
  'src/lib/app-branding.js',
  // Gallery UI (white screen + folder tiles)
  'src/components/gallery/MobileGallery.jsx',
  'src/components/gallery/folderActionStyles.js',
  'src/components/gallery/OrganizeButton.jsx',
  'src/components/gallery/CustomFolderButton.jsx',
  'src/components/gallery/DuplicateDetector.jsx',
  'src/components/ui/BrandGradientIcon.jsx',
  'src/Layout.jsx',
  'src/index.css',
];

console.log(`Base44 publish file list (deploy v${deployBuild})\n`);
console.log('Paste each file into the Base44 Code editor, then click Publish:\n');
PUBLISH_FILES.forEach((f) => console.log(`  - ${f}`));
console.log(`
After Publish, verify:
  1. View source on https://restorebraine.base44.app — the script src must NOT be index-DVkubWP5.js
  2. Hard refresh Safari (Settings → Safari → Clear History) or use Private tab
  3. Sign In should go to https://app.base44.com/login?app_id=68fdc5f42768c4d045fe1bac (NOT base44.app/login)

Mac copy commands (paste into Base44 editor, NOT Terminal):
  pbcopy < src/lib/AuthContext.jsx
  pbcopy < src/lib/app-params.js
  pbcopy < src/components/gallery/MobileGallery.jsx

iOS test without waiting for Base44:
  npm run build:native-local
  (do NOT run cap:hosted after)
  Xcode: Product → Clean Build Folder, delete app, Run
`);
