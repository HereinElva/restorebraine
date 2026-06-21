/**
 * Restorebraine iOS launch screen — app logo with rounded corners (no white box), gradient splash.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const logoSourceCandidates = [
  resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'),
  resolve('public/AppIcon.png'),
  resolve('public/login-logo.png'),
];

const logoSource = logoSourceCandidates.find((p) => existsSync(p));
if (!logoSource) {
  console.error('FAIL: no logo source — run npm run ios:icons first');
  process.exit(1);
}

const launchLogoDir = resolve('ios/App/App/Assets.xcassets/LaunchLogo.imageset');
const splashDir = resolve('ios/App/App/Assets.xcassets/Splash.imageset');

mkdirSync(launchLogoDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

/** Rounded-rect PNG with transparent corners (no white box on gradient background). */
async function roundedLaunchLogo(size) {
  const radius = Math.round(size * 0.22);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`,
  );
  return sharp(logoSource)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const launchSizes = [
  { filename: 'launch-logo.png', size: 128 },
  { filename: 'launch-logo@2x.png', size: 256 },
  { filename: 'launch-logo@3x.png', size: 384 },
];

for (const { filename, size } of launchSizes) {
  const buffer = await roundedLaunchLogo(size);
  writeFileSync(resolve(launchLogoDir, filename), buffer);
}

writeFileSync(
  resolve(launchLogoDir, 'Contents.json'),
  `${JSON.stringify(
    {
      images: [
        { filename: 'launch-logo.png', idiom: 'universal', scale: '1x' },
        { filename: 'launch-logo@2x.png', idiom: 'universal', scale: '2x' },
        { filename: 'launch-logo@3x.png', idiom: 'universal', scale: '3x' },
      ],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  )}\n`,
);

const splashSize = 2732;
const logoOnSplash = 320;
const logoBuffer = await roundedLaunchLogo(logoOnSplash);

const gradientSvg = `
<svg width="${splashSize}" height="${splashSize}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eff6ff"/>
      <stop offset="50%" stop-color="#f5f3ff"/>
      <stop offset="100%" stop-color="#fdf2f8"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;

const splashBase = await sharp(Buffer.from(gradientSvg)).png().toBuffer();
const left = Math.round((splashSize - logoOnSplash) / 2);
const top = Math.round((splashSize - logoOnSplash) / 2 - 40);

const splashBuffer = await sharp(splashBase)
  .composite([{ input: logoBuffer, left, top }])
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const filename of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  writeFileSync(resolve(splashDir, filename), splashBuffer);
}

writeFileSync(
  resolve(splashDir, 'Contents.json'),
  `${JSON.stringify(
    {
      images: [
        { filename: 'splash-2732x2732-2.png', idiom: 'universal', scale: '1x' },
        { filename: 'splash-2732x2732-1.png', idiom: 'universal', scale: '2x' },
        { filename: 'splash-2732x2732.png', idiom: 'universal', scale: '3x' },
      ],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  )}\n`,
);

console.log(`OK: LaunchLogo (rounded, transparent corners) + Splash from ${logoSource}`);
