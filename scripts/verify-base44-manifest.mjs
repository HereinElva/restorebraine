#!/usr/bin/env node
/**
 * Verify Base44 publish manifest includes Omega 3 gallery stack + v87 deps.
 * Past "43 file" publish missed PullToRefresh, PhotoModal, etc. → stale App chunk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { TIER_FULL, TIER_GALLERY, OMEGA3_TAG } from './base44-v87-publish-manifest.mjs';

const REQUIRED_GALLERY_IMPORTS = [
  'src/components/gallery/PullToRefresh.jsx',
  'src/components/gallery/PhotoModal.jsx',
  'src/components/gallery/SelectablePhotoGrid.jsx',
  'src/components/gallery/CustomFolderButton.jsx',
  'src/components/gallery/FolderGrid.jsx',
  'src/components/gallery/SelectionToolbar.jsx',
  'src/components/gallery/DuplicateDetector.jsx',
  'src/components/NavigationContext.jsx',
  'src/components/TabStateContext.jsx',
  'src/lib/media-organize.js',
  'src/utils/index.ts',
];

const tier = new Set(TIER_FULL);
const missing = REQUIRED_GALLERY_IMPORTS.filter((f) => !tier.has(f));
const missingOnDisk = TIER_FULL.filter((f) => !existsSync(f));

console.log('═══════════════════════════════════════════════════════════════');
console.log(' BASE44 MANIFEST CHECK — Omega 3 gallery + v87 full publish');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`TIER_FULL: ${TIER_FULL.length} files (reference: ${OMEGA3_TAG} gallery stack)`);
console.log(`TIER_GALLERY: ${TIER_GALLERY.length} gallery files\n`);

let failed = 0;

if (missing.length) {
  failed += 1;
  console.log('✗ Required gallery deps missing from TIER_FULL:');
  for (const f of missing) console.log(`    ${f}`);
} else {
  console.log('✓ All Omega 3 gallery deps in TIER_FULL');
}

if (missingOnDisk.length) {
  failed += 1;
  console.log('\n✗ Manifest lists files missing on disk:');
  for (const f of missingOnDisk) console.log(`    ${f}`);
} else {
  console.log('✓ All manifest files exist on disk');
}

console.log('\n───────────────────────────────────────────────────────────────');
if (failed) {
  console.log(' MANIFEST INCOMPLETE — full Publish would leave stale App chunk');
  process.exit(1);
}

console.log(' MANIFEST OK — paste ALL files → Publish once');
console.log(' Run: npm run base44:export-pack');
console.log('═══════════════════════════════════════════════════════════════\n');
