import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const destination1024 = resolve(iconSetDir, 'AppIcon-1024.png');
const publicIcon = resolve('public/AppIcon.png');

/** Matches in-app header: blue-purple gradient + white search icon */
const brandedIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#93c5fd"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g fill="none" stroke="#ffffff" stroke-width="72" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="448" cy="448" r="192"/>
    <line x1="582" y1="582" x2="736" y2="736"/>
  </g>
</svg>
`;

mkdirSync(iconSetDir, { recursive: true });
mkdirSync(resolve('public'), { recursive: true });

const pngBuffer = await sharp(Buffer.from(brandedIconSvg))
  .flatten({ background: { r: 147, g: 197, b: 253 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(pngBuffer).toFile(destination1024);
await sharp(pngBuffer).toFile(publicIcon);

const meta = await sharp(destination1024).metadata();
console.log(`Generated branded Restorebraine app icon -> ${destination1024} (${meta.width}x${meta.height})`);
