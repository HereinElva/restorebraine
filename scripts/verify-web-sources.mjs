import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = [
  'src/lib/native-media-input.js',
  'src/lib/media-upload.js',
  'src/lib/upload-pipeline.js',
  'src/components/upload/AiUploadConsentModal.jsx',
];

const missing = required.filter((rel) => !existsSync(resolve(rel)));

if (missing.length) {
  console.error('\nBuild blocked — required source files are missing:\n');
  for (const file of missing) console.error(`  - ${file}`);
  console.error('\nYou are probably on branch `main`. Sync to the iOS build branch first:\n');
  console.error('  git fetch origin cursor/apple-privacy-plist-bacf');
  console.error('  git checkout cursor/apple-privacy-plist-bacf');
  console.error('  git reset --hard origin/cursor/apple-privacy-plist-bacf');
  console.error('  bash scripts/mac-ios-setup.sh cursor/apple-privacy-plist-bacf\n');
  process.exit(1);
}

console.log('OK: required web source files present');
