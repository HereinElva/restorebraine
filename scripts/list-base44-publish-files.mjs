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
  'src/components/LoginLogo.jsx',
  'src/lib/login-logo-data.js',
  'src/lib/native-hosted-redirect.js',
  'src/lib/native-bundle-mode.js',
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
  'src/pages/Account.jsx',
  'src/index.css',
];

console.log(`Base44 publish file list (deploy v${deployBuild})\n`);
console.log('Run for full copy/paste commands:');
console.log('  bash scripts/base44-publish-copy-commands.sh\n');
console.log('Or use pre-built code blocks:');
console.log(`  base44-publish-v${deployBuild}.txt\n`);
console.log('Paste each file into the Base44 Code editor, then click Publish:\n');
PUBLISH_FILES.forEach((f, i) => {
  const num = String(i + 1).padStart(2, ' ');
  console.log(`  ${num}. ${f}`);
  console.log(`      pbcopy < "${f}"`);
});
