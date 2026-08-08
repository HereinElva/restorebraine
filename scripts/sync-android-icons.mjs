import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const logoSource = resolve('public/AppIcon.png');
const logoDestination = resolve('assets/logo.png');

if (!existsSync(logoSource)) {
  console.error('Missing public/AppIcon.png — run: node scripts/sync-app-icon.mjs');
  process.exit(1);
}

mkdirSync(dirname(logoDestination), { recursive: true });
copyFileSync(logoSource, logoDestination);
console.log(`Synced logo: ${logoSource} -> ${logoDestination}`);

const result = spawnSync(
  'npx',
  ['@capacitor/assets', 'generate', '--android', '--iconBackgroundColor', '#ffffff'],
  { stdio: 'inherit' }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Android launcher icons and splash screens generated.');
