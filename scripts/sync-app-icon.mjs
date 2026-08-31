import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const candidates = [
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png',
];

const publicDir = resolve('public');
const destination = resolve(publicDir, 'AppIcon.png');
const loginLogo = resolve(publicDir, 'login-logo.png');
mkdirSync(dirname(destination), { recursive: true });

const source = candidates.map((candidate) => resolve(candidate)).find((candidate) => existsSync(candidate));

if (!source) {
  console.warn('No iOS app icon source found; leaving public/AppIcon.png unchanged.');
  process.exit(0);
}

copyFileSync(source, destination);
console.log(`Synced app icon: ${source} -> ${destination}`);

await sharp(source)
  .resize(128, 128, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toFile(loginLogo);

const loginBytes = (await import('node:fs')).readFileSync(loginLogo).length;
console.log(`Wrote login logo: ${loginLogo} (${loginBytes} bytes)`);
