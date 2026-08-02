#!/usr/bin/env node
/**
 * Split v87 paste pack into batches for Base44 in-app AI chat.
 * Base44 AI cannot read your Mac — paste one batch file at a time into chat.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TIER_OAUTH,
  TIER_APP_SHELL,
  TIER_GALLERY,
  TIER_CONTEXT,
  TIER_UPLOAD,
  TIER_LIB_MEDIA,
  TIER_UTILS,
  TIER_FULL,
} from './base44-v87-publish-manifest.mjs';

const OUT_DIR = resolve('base44-paste-batches');

const BATCHES = [
  {
    name: '01-oauth-auth',
    label: 'OAuth + auth (paste first)',
    files: [...new Set([...TIER_OAUTH, 'src/api/base44Client.js'])],
  },
  {
    name: '02-app-shell',
    label: 'App shell + signed-out UI',
    files: TIER_APP_SHELL.filter((f) => !TIER_OAUTH.includes(f)),
  },
  {
    name: '03-gallery-core',
    label: 'Gallery pages + MobileGallery + Organize',
    files: [
      'src/pages/Gallery.jsx',
      'src/components/gallery/MobileGallery.jsx',
      'src/components/gallery/OrganizeButton.jsx',
      'src/components/gallery/EmptyState.jsx',
      'src/components/gallery/FolderView.jsx',
      'src/components/gallery/folderActionStyles.js',
      'src/components/gallery/PullToRefresh.jsx',
    ],
  },
  {
    name: '04-gallery-components',
    label: 'Gallery components (Omega 3 stack)',
    files: TIER_GALLERY.filter(
      (f) => ![
        'src/pages/Gallery.jsx',
        'src/components/gallery/MobileGallery.jsx',
        'src/components/gallery/OrganizeButton.jsx',
        'src/components/gallery/EmptyState.jsx',
        'src/components/gallery/FolderView.jsx',
        'src/components/gallery/folderActionStyles.js',
        'src/components/gallery/PullToRefresh.jsx',
      ].includes(f),
    ),
  },
  {
    name: '05-context-layout-css',
    label: 'Navigation context + CSS (shell files in batch 02)',
    files: [
      ...TIER_CONTEXT,
      'src/App.css',
      'src/index.css',
      'src/pages.config.js',
    ],
  },
  {
    name: '06-upload',
    label: 'Upload page + components',
    files: TIER_UPLOAD,
  },
  {
    name: '07-media-libs',
    label: 'Media organize + upload libs (Omega 3)',
    files: TIER_LIB_MEDIA,
  },
  {
    name: '08-utils-pages',
    label: 'Utils, hooks, remaining pages',
    files: [
      ...TIER_UTILS,
      'src/pages/Account.jsx',
      'src/pages/Home.jsx',
      'src/pages/PrivacyPolicy.jsx',
      'src/pages/PaymentSuccess.jsx',
      'src/lib/gallery-nav.js',
      'src/lib/app-params.js',
      'src/lib/capacitor-ready.js',
      'src/lib/persistentStorage.js',
      'src/lib/forceLogout.js',
    ],
  },
];

function formatFile(rel) {
  const body = readFileSync(resolve(rel), 'utf8');
  return `\n${'='.repeat(72)}\nFILE: ${rel}\n${'='.repeat(72)}\n${body}`;
}

function batchPrompt(batchNum, total, label, fileList) {
  return `# Base44 AI — apply batch ${batchNum}/${total}: ${label}

Write EVERY file below into the Restorebraine Base44 code editor at the exact path shown.
Do NOT Publish until batch ${total} is done — user will Publish once after all batches.

For each FILE block:
1. Open or create that path in the code editor
2. Replace entire file contents with the code below
3. Save

${fileList.map((f, i) => `${i + 1}. ${f}`).join('\n')}
`;
}

mkdirSync(OUT_DIR, { recursive: true });

const allInBatches = new Set();
const written = [];

for (let i = 0; i < BATCHES.length; i += 1) {
  const batch = BATCHES[i];
  const existing = batch.files.filter((f) => {
    try {
      readFileSync(resolve(f));
      return true;
    } catch {
      console.warn(`Skip missing: ${f}`);
      return false;
    }
  });
  existing.forEach((f) => allInBatches.add(f));

  const content = batchPrompt(i + 1, BATCHES.length, batch.label, existing)
    + existing.map(formatFile).join('\n');

  const outPath = resolve(OUT_DIR, `BASE44-BATCH-${batch.name}.txt`);
  writeFileSync(outPath, content);
  written.push({ path: outPath, files: existing.length, label: batch.label });
}

const missingFromFull = TIER_FULL.filter((f) => !allInBatches.has(f));
if (missingFromFull.length) {
  const extra = missingFromFull.filter((f) => {
    try { readFileSync(resolve(f)); return true; } catch { return false; }
  });
  if (extra.length) {
    const content = batchPrompt(BATCHES.length + 1, BATCHES.length + 1, 'Remaining files', extra)
      + extra.map(formatFile).join('\n');
    const outPath = resolve(OUT_DIR, 'BASE44-BATCH-09-remaining.txt');
    writeFileSync(outPath, content);
    written.push({ path: outPath, files: extra.length, label: 'Remaining' });
  }
}

const indexLines = [
  '# Base44 paste batches — for Base44 in-app AI chat',
  '',
  'Base44 AI cannot read your Mac. Paste ONE batch file at a time into Base44 chat.',
  '',
  '## Prompt to paste WITH each batch',
  '',
  '```',
  'Apply every FILE block below to the Restorebraine code editor.',
  'Write each file at the exact path shown. Do not Publish yet.',
  '```',
  '',
  'Then paste the contents of the batch file.',
  '',
  '## Batches (in order)',
  '',
  ...written.map((w, i) => `${i + 1}. \`${w.path.split('/').pop()}\` — ${w.files} files — ${w.label}`),
  '',
  `Total: ${[...allInBatches].length + (missingFromFull.length ? missingFromFull.length : 0)} files across ${written.length} batches`,
  '',
  'After batch 8 (or 9): click Publish ONCE in Base44.',
  'Mac: npm run align:watch',
  '',
];

writeFileSync(resolve(OUT_DIR, 'README.txt'), indexLines.join('\n'));

console.log(`Wrote ${written.length} batches → ${OUT_DIR}/`);
for (const w of written) {
  console.log(`  ${w.files.toString().padStart(2)} files  ${w.path.split('/').pop()}  (${w.label})`);
}
console.log(`\nOpen: cat base44-paste-batches/README.txt`);
