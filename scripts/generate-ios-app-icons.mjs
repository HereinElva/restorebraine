import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');

const sourceCandidates = [
  resolve(iconSetDir, 'Icon-Any-1024.png'),
  resolve(iconSetDir, 'AppIcon-512@2x.png'),
  resolve(iconSetDir, 'AppIcon-1024.png'),
  resolve('public/AppIcon.png'),
];

const source = sourceCandidates.find((candidate) => existsSync(candidate));

if (!source) {
  console.error('No 1024px app icon source found — run npm install and ensure public/AppIcon.png exists.');
  process.exit(1);
}

mkdirSync(iconSetDir, { recursive: true });

const anyBuffer = await sharp(source)
  .flatten({ background: { r: 147, g: 197, b: 253 } })
  .resize(1024, 1024, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toBuffer();

const tintedBuffer = await sharp(anyBuffer)
  .grayscale()
  .flatten({ background: { r: 0, g: 0, b: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

const outputs = [
  { filename: 'Icon-Any-1024.png', buffer: anyBuffer },
  { filename: 'Icon-Dark-1024.png', buffer: anyBuffer },
  { filename: 'Icon-Tinted-1024.png', buffer: tintedBuffer },
  { filename: 'AppIcon-512@2x.png', buffer: anyBuffer },
  { filename: 'AppIcon-1024.png', buffer: anyBuffer },
];

for (const { filename, buffer } of outputs) {
  await sharp(buffer).toFile(resolve(iconSetDir, filename));
}

const keep = new Set(outputs.map(({ filename }) => filename));
for (const filename of readdirSync(iconSetDir)) {
  if (!filename.endsWith('.png') || keep.has(filename)) continue;
  unlinkSync(resolve(iconSetDir, filename));
}

const contents = {
  images: [
    {
      filename: 'Icon-Any-1024.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      filename: 'Icon-Dark-1024.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'tinted' }],
      filename: 'Icon-Tinted-1024.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
  ],
  info: { author: 'xcode', version: 1 },
};

writeFileSync(resolve(iconSetDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);

console.log('Wrote Xcode 16 AppIcon with separate Any / Dark / Tinted PNG files');
