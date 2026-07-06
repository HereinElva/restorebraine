/**
 * Generates base44-publish-v{N}.txt — labeled paths + full file contents for Base44 editor.
 * Usage: node scripts/generate-base44-publish.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

execSync('node scripts/embed-login-logo.mjs', { stdio: 'inherit' });

const deployBuild =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';

const FILES = [
  'index.html',
  'public/native-oauth-return.js',
  'public/login-redirect.js',
  'src/main.jsx',
  'src/deploy-marker.js',
  'src/lib/app-params.js',
  'src/lib/app-domains.js',
  'src/lib/auth-urls.js',
  'src/lib/sign-in-with-provider.js',
  'src/lib/sign-in-with-google.js',
  'src/lib/AuthContext.jsx',
  'src/api/base44Client.js',
  'src/App.jsx',
  'src/screens/SignInScreen.jsx',
  'src/screens/sign-in.css',
  'src/components/NativeLoginCard.jsx',
  'src/components/SignInWithAppleButton.jsx',
  'src/components/AppleLogo.jsx',
  'public/apple-sign-in-logo.svg',
  'src/components/LoginPage.jsx',
  'src/components/LoginLogo.jsx',
  'src/lib/login-logo-data.js',
  'src/lib/native-hosted-redirect.js',
  'src/lib/native-bundle-mode.js',
  'src/lib/native-oauth-fix.js',
  'src/lib/native-platform-guard.js',
  'src/lib/native-google-oauth.js',
  'src/lib/session-bootstrap.js',
  'src/lib/app-branding.js',
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

const PARTS = [
  { label: 'PART 1 — Boot + auth (paste first)', files: FILES.slice(0, 12) },
  { label: 'PART 2 — Native OAuth + session', files: FILES.slice(12, 20) },
  { label: 'PART 3 — Gallery UI + Layout + CSS (paste last, then Publish)', files: FILES.slice(20) },
];

function readPublishContent(path) {
  if (path === 'src/lib/native-bundle-mode.js') {
    return `// Base44 hosted web — must be false (iOS v4 native uses true via build:native-local)
export const LOCAL_NATIVE_BUNDLE = false;
`;
  }
  return readFileSync(resolve(path), 'utf8');
}

function block(path) {
  const content = readPublishContent(path);
  return [
    '',
    '════════════════════════════════════════════════════════════',
    `BASE44 PATH: ${path}`,
    'ACTION: Open this exact path in the Base44 Code editor → Select All → Paste → Save',
    '════════════════════════════════════════════════════════════',
    content,
    '',
  ].join('\n');
}

const lines = [
  `Restorebraine Base44 Publish Pack — deploy v${deployBuild}`,
  '',
  'HOW TO USE (recommended — do NOT scroll this file):',
  '',
  '  bash scripts/base44-publish-wizard.sh',
  '',
  'The wizard copies ONE file at a time to your clipboard and tells you',
  'which Base44 path to open. Select All → Paste → Save → Enter for next.',
  'After all 35 files → Publish once.',
  '',
  'Short guide: docs/BASE44-PUBLISH.md',
  '',
  'This file is a backup reference only. Use the wizard instead.',
  '',
  'Manual one-file copy:  pbcopy < src/Layout.jsx',
  '',
];

for (const part of PARTS) {
  lines.push('', '╔════════════════════════════════════════════════════════════╗');
  lines.push(`║  ${part.label.padEnd(58)}║`);
  lines.push('╚════════════════════════════════════════════════════════════╝');
  for (const f of part.files) {
    lines.push(block(f));
  }
}

lines.push(
  '',
  'AFTER PUBLISH — verify:',
  '  • View source on https://restorebraine.base44.app',
  `  • Must show: <meta name="restorebraine-deploy" content="v${deployBuild}">`,
  '  • JS bundle hash must change (not index-CGrESmC2.js or index-DVkubWP5.js)',
  '  • App shows Sign In screen or gallery — NOT blank white page',
);

const outPath = resolve(`base44-publish-v${deployBuild}.txt`);
writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${outPath} (${lines.join('\n').length} chars, ${FILES.length} files)`);

for (let i = 0; i < PARTS.length; i += 1) {
  const part = PARTS[i];
  const partLines = [
    `Restorebraine Base44 Publish — ${part.label} (deploy v${deployBuild})`,
    '',
    'For each block: open BASE44 PATH in Code editor → Select All → Paste code below divider → Save',
    '',
  ];
  for (const f of part.files) {
    partLines.push(block(f));
  }
  if (i === PARTS.length - 1) {
    partLines.push(
      '',
      '>>> NOW CLICK PUBLISH in Base44 <<<',
      '',
      'Verify after publish:',
      `  meta name="restorebraine-deploy" content="v${deployBuild}"`,
      '  App shows Sign In or gallery (not white screen)',
    );
  } else {
    partLines.push('', `>>> Continue with Part ${i + 2} before clicking Publish <<<`);
  }
  const partPath = resolve(`base44-publish-v${deployBuild}-part${i + 1}.txt`);
  writeFileSync(partPath, partLines.join('\n'));
  console.log(`Wrote ${partPath}`);
}
