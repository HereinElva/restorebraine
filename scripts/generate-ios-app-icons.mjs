import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const universalIcon = resolve(iconSetDir, 'AppIcon-512@2x.png');

const sourceCandidates = [
  universalIcon,
  resolve(iconSetDir, 'AppIcon-1024.png'),
  resolve(iconSetDir, 'appstore.png'),
  resolve('public/AppIcon.png'),
];

const source = sourceCandidates.find((candidate) => existsSync(candidate));

if (!source) {
  console.error('No 1024px app icon source found — run npm install and ensure public/AppIcon.png exists.');
  process.exit(1);
}

mkdirSync(iconSetDir, { recursive: true });

const iconBuffer = await sharp(source)
  .flatten({ background: { r: 147, g: 197, b: 253 } })
  .resize(1024, 1024, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(iconBuffer).toFile(universalIcon);

for (const alias of ['AppIcon-1024.png', 'appstore.png']) {
  await sharp(iconBuffer).toFile(resolve(iconSetDir, alias));
}

for (const filename of readdirSync(iconSetDir)) {
  if (!filename.endsWith('.png')) continue;
  if (['AppIcon-512@2x.png', 'AppIcon-1024.png', 'appstore.png'].includes(filename)) continue;
  unlinkSync(resolve(iconSetDir, filename));
}

const contents = {
  images: [
    {
      filename: 'AppIcon-512@2x.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      filename: 'AppIcon-512@2x.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'tinted' }],
      filename: 'AppIcon-512@2x.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
  ],
  info: { author: 'xcode', version: 1 },
};

writeFileSync(resolve(iconSetDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);

console.log('Wrote Xcode 16 universal AppIcon (Any + Dark + Tinted -> AppIcon-512@2x.png)');
