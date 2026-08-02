#!/usr/bin/env node
/**
 * Port Omega 3 gallery/organize stack into v87 baseline.
 * Keeps v87 auth (SignedOutLanding, OAuth f1b2505) — no SignInScreen or bundled experiments.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OMEGA3_TAG } from './base44-v87-publish-manifest.mjs';

/** v87 branch owns these — Omega 3 caps organize at 20 items/run. Do not overwrite. */
const V87_ORGANIZE_KEEP = new Set([
  'src/lib/run-media-organize.js',
  'src/lib/folder-membership.js',
  'src/lib/media-organize.js',
  'src/components/gallery/OrganizeButton.jsx',
]);

const GALLERY_FILES = [
  'src/lib/gallery-organize-snapshot.js',
  'src/lib/run-media-organize.js',
  'src/lib/folder-membership.js',
  'src/lib/folder-membership-cache.js',
  'src/lib/gallery-query-keys.js',
  'src/lib/gallery-data.js',
  'src/lib/media-organize.js',
  'src/lib/scroll-reset.js',
  'src/components/gallery/OrganizeButton.jsx',
  'src/components/gallery/PullToRefresh.jsx',
  'src/components/gallery/mobile-gallery-layout.css',
  'src/pages/Gallery.jsx',
];

const FORBIDDEN_IN_PORT = [
  'SignInScreen',
  'NativeLoginCard',
  'NativeLoginProviders',
  'native-bundle-mode',
  'native-bundle-shell-guard',
  'RestorebraineBridgeViewController',
  'native-shell-stabilizer',
];

function checkoutFromOmega3(rel) {
  execSync(`git checkout ${OMEGA3_TAG} -- ${rel}`, { stdio: 'pipe' });
}

function patchGalleryAuth() {
  const galleryPath = resolve('src/pages/Gallery.jsx');
  let src = readFileSync(galleryPath, 'utf8');
  src = src.replace(
    /import \{ hasStoredSessionToken \} from "@\/screens\/SignInScreen";\nimport \{ ensureClientSessionToken \} from "@\/lib\/session-bootstrap";/,
    'import { ensureClientSessionToken, hasStoredSessionToken } from "@/lib/session-bootstrap";',
  );
  src = src.replace(
    /import \{ hasStoredSessionToken \} from '@\/screens\/SignInScreen';[\s\S]*?import \{ ensureClientSessionToken \} from '@\/lib\/session-bootstrap';/,
    "import { ensureClientSessionToken, hasStoredSessionToken } from '@/lib/session-bootstrap';",
  );
  if (src.includes('SignInScreen')) {
    throw new Error('Gallery.jsx still imports SignInScreen — manual patch required');
  }
  writeFileSync(galleryPath, src);
}

console.log(`Porting Omega 3 gallery stack from tag ${OMEGA3_TAG}...\n`);

for (const rel of GALLERY_FILES) {
  if (V87_ORGANIZE_KEEP.has(rel)) {
    console.log(`  ⊘ ${rel} (keep v87 — full-batch organize)`);
    continue;
  }
  checkoutFromOmega3(rel);
  console.log(`  ✓ ${rel}`);
}

patchGalleryAuth();
console.log('  ✓ Gallery.jsx auth patched for v87 (session-bootstrap, not SignInScreen)');

for (const rel of GALLERY_FILES) {
  const content = readFileSync(resolve(rel), 'utf8');
  for (const bad of FORBIDDEN_IN_PORT) {
    if (content.includes(bad)) {
      throw new Error(`${rel} contains forbidden post-v87 pattern: ${bad}`);
    }
  }
}

console.log('\nOK: Omega 3 gallery stack ported — v87 auth preserved, no forbidden patterns.');
