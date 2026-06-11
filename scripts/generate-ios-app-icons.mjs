import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const masterIcon = resolve(iconSetDir, 'AppIcon-1024.png');

const sourceCandidates = [
  masterIcon,
  resolve('public/AppIcon.png'),
];

const source = sourceCandidates.find((candidate) => existsSync(candidate));

if (!source) {
  console.error('No 1024px app icon source found — run npm install and ensure public/AppIcon.png exists.');
  process.exit(1);
}

mkdirSync(iconSetDir, { recursive: true });

if (resolve(source) !== resolve(masterIcon)) {
  await sharp(source)
    .flatten({ background: { r: 147, g: 197, b: 253 } })
    .resize(1024, 1024, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(masterIcon);
}

for (const filename of readdirSync(iconSetDir)) {
  if (!filename.endsWith('.png') || filename === 'AppIcon-1024.png') continue;
  unlinkSync(resolve(iconSetDir, filename));
}

for (const stray of ['AppIcon-512@2x.png', 'appstore.png', 'playstore.png']) {
  const strayPath = resolve(iconSetDir, stray);
  if (existsSync(strayPath)) unlinkSync(strayPath);
}

writeFileSync(
  resolve(iconSetDir, 'Contents.json'),
  `${JSON.stringify({
    images: [
      {
        filename: 'AppIcon-1024.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      },
    ],
    info: { author: 'xcode', version: 1 },
  }, null, 2)}\n`
);

console.log(`Wrote single-size iOS AppIcon (1024 universal) -> ${masterIcon}`);
