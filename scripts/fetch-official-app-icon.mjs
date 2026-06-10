import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

export const OFFICIAL_APP_ICON_URL =
  'https://media.base44.com/images/public/68fdc5f42768c4d045fe1bac/e76571efc_appstore.png';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const destination1024 = resolve(iconSetDir, 'AppIcon-1024.png');
const tempPath = resolve(iconSetDir, '.AppIcon-1024-download.png');

export async function downloadOfficialIcon() {
  mkdirSync(iconSetDir, { recursive: true });

  const response = await fetch(OFFICIAL_APP_ICON_URL);
  if (!response.ok) {
    throw new Error(`Failed to download official app icon (${response.status})`);
  }

  await pipeline(response.body, createWriteStream(tempPath));
}

export async function normalizeIcon() {
  await sharp(tempPath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(1024, 1024, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(destination1024);

  const meta = await sharp(destination1024).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`Official app icon must be 1024x1024, got ${meta.width}x${meta.height}`);
  }

  try { unlinkSync(tempPath); } catch {}
}

const isDirectRun = process.argv[1]?.endsWith('fetch-official-app-icon.mjs');

if (isDirectRun) {
  try {
    await downloadOfficialIcon();
    await normalizeIcon();
    console.log(`Fetched official Restorebraine app icon -> ${destination1024}`);
  } catch (error) {
    if (existsSync(destination1024)) {
      console.warn(`Using existing AppIcon-1024.png (${error.message})`);
      process.exit(0);
    }
    console.error(error.message);
    process.exit(1);
  }
}
