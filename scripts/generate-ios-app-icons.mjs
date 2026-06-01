import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');

const sourceCandidates = [
  resolve(iconSetDir, 'AppIcon-1024.png'),
  resolve('public/AppIcon.png'),
];

const source = sourceCandidates.find((candidate) => existsSync(candidate));

if (!source) {
  console.error('No 1024px app icon source found — run npm install and ensure public/AppIcon.png exists.');
  process.exit(1);
}

const icons = [
  { filename: 'AppIcon-20@2x.png', size: 40 },
  { filename: 'AppIcon-20@3x.png', size: 60 },
  { filename: 'AppIcon-29@2x.png', size: 58 },
  { filename: 'AppIcon-29@3x.png', size: 87 },
  { filename: 'AppIcon-40@2x.png', size: 80 },
  { filename: 'AppIcon-40@3x.png', size: 120 },
  { filename: 'AppIcon-60@2x.png', size: 120 },
  { filename: 'AppIcon-60@3x.png', size: 180 },
  { filename: 'AppIcon-20~ipad.png', size: 20 },
  { filename: 'AppIcon-20@2x~ipad.png', size: 40 },
  { filename: 'AppIcon-29~ipad.png', size: 29 },
  { filename: 'AppIcon-29@2x~ipad.png', size: 58 },
  { filename: 'AppIcon-40~ipad.png', size: 40 },
  { filename: 'AppIcon-40@2x~ipad.png', size: 80 },
  { filename: 'AppIcon-76~ipad.png', size: 76 },
  { filename: 'AppIcon-76@2x~ipad.png', size: 152 },
  { filename: 'AppIcon-83.5@2x~ipad.png', size: 167 },
  { filename: 'AppIcon-1024.png', size: 1024 },
];

mkdirSync(iconSetDir, { recursive: true });

for (const { filename, size } of icons) {
  const destination = resolve(iconSetDir, filename);
  if (resolve(destination) === resolve(source)) {
    continue;
  }
  await sharp(source)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(destination);
}

for (const stray of ['AppIcon-512@2x.png', 'appstore.png', 'playstore.png']) {
  const strayPath = resolve(iconSetDir, stray);
  if (existsSync(strayPath)) {
    unlinkSync(strayPath);
  }
}

console.log(`Generated ${icons.length} iOS app icons from ${source}`);
