/**
 * Restorebraine iOS launch screen — gradient background, title in storyboard only (no logo).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const splashDir = resolve('ios/App/App/Assets.xcassets/Splash.imageset');
mkdirSync(splashDir, { recursive: true });

const splashSize = 2732;
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

const splashBuffer = await sharp(Buffer.from(gradientSvg)).png({ compressionLevel: 9 }).toBuffer();

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

console.log('OK: Splash gradient only (no logo) — LaunchScreen.storyboard shows title text only');
