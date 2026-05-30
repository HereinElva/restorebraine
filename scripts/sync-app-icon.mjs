import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const candidates = [
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/appstore.png',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
];

const destination = resolve('public/AppIcon.png');
mkdirSync(dirname(destination), { recursive: true });

const source = candidates.map((candidate) => resolve(candidate)).find((candidate) => existsSync(candidate));

if (!source) {
  console.warn('No iOS app icon source found; leaving public/AppIcon.png unchanged.');
  process.exit(0);
}

copyFileSync(source, destination);
console.log(`Synced app icon: ${source} -> ${destination}`);
