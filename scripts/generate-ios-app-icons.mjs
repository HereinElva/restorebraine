import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const marketingIcon = resolve(iconSetDir, 'AppIcon-1024.png');

const sourceCandidates = [
  marketingIcon,
  resolve(iconSetDir, 'Icon-Any-1024.png'),
  resolve(iconSetDir, 'AppIcon-512@2x.png'),
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
    .flatten({ background: { r: 147, g: 197, b: 253 } })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

if (resolve(source) !== resolve(marketingIcon)) {
  await sharp(source)
    .flatten({ background: { r: 147, g: 197, b: 253 } })
    .resize(1024, 1024, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(marketingIcon);
}

const keep = new Set(icons.map(({ filename }) => filename));
for (const filename of readdirSync(iconSetDir)) {
  if (!filename.endsWith('.png') || keep.has(filename)) continue;
  unlinkSync(resolve(iconSetDir, filename));
}

const contents = {
  images: [
    { filename: 'AppIcon-20@2x.png', idiom: 'iphone', scale: '2x', size: '20x20' },
    { filename: 'AppIcon-20@3x.png', idiom: 'iphone', scale: '3x', size: '20x20' },
    { filename: 'AppIcon-29@2x.png', idiom: 'iphone', scale: '2x', size: '29x29' },
    { filename: 'AppIcon-29@3x.png', idiom: 'iphone', scale: '3x', size: '29x29' },
    { filename: 'AppIcon-40@2x.png', idiom: 'iphone', scale: '2x', size: '40x40' },
    { filename: 'AppIcon-40@3x.png', idiom: 'iphone', scale: '3x', size: '40x40' },
    { filename: 'AppIcon-60@2x.png', idiom: 'iphone', scale: '2x', size: '60x60' },
    { filename: 'AppIcon-60@3x.png', idiom: 'iphone', scale: '3x', size: '60x60' },
    { filename: 'AppIcon-20~ipad.png', idiom: 'ipad', scale: '1x', size: '20x20' },
    { filename: 'AppIcon-20@2x~ipad.png', idiom: 'ipad', scale: '2x', size: '20x20' },
    { filename: 'AppIcon-29~ipad.png', idiom: 'ipad', scale: '1x', size: '29x29' },
    { filename: 'AppIcon-29@2x~ipad.png', idiom: 'ipad', scale: '2x', size: '29x29' },
    { filename: 'AppIcon-40~ipad.png', idiom: 'ipad', scale: '1x', size: '40x40' },
    { filename: 'AppIcon-40@2x~ipad.png', idiom: 'ipad', scale: '2x', size: '40x40' },
    { filename: 'AppIcon-76~ipad.png', idiom: 'ipad', scale: '1x', size: '76x76' },
    { filename: 'AppIcon-76@2x~ipad.png', idiom: 'ipad', scale: '2x', size: '76x76' },
    { filename: 'AppIcon-83.5@2x~ipad.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5' },
    { filename: 'AppIcon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
  ],
  info: { author: 'xcode', version: 1 },
};

writeFileSync(resolve(iconSetDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);

console.log(`Generated classic AppIcon grid (18 sizes + App Store 1024pt -> AppIcon-1024.png)`);
