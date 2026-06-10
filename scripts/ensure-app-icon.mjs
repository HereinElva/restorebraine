import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { downloadOfficialIcon, normalizeIcon, OFFICIAL_APP_ICON_URL } from './fetch-official-app-icon.mjs';

const iconSetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const destination1024 = resolve(iconSetDir, 'AppIcon-1024.png');

/** Base44 CDN currently serves a generic placeholder — not the in-app logo. */
async function looksLikePlaceholder(path) {
  try {
    const { data, info } = await sharp(path)
      .resize(64, 64, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let whitePixels = 0;
    const channels = info.channels;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 230 && g > 230 && b > 230) whitePixels += 1;
    }
    return whitePixels / (64 * 64) > 0.08;
  } catch {
    return true;
  }
}

let usedBranded = false;

try {
  await downloadOfficialIcon();
  await normalizeIcon();
  if (await looksLikePlaceholder(destination1024)) {
    console.warn(`Official icon at ${OFFICIAL_APP_ICON_URL} looks like a placeholder — generating branded icon.`);
    await import('./generate-branded-app-icon.mjs');
    usedBranded = true;
  } else {
    console.log(`Using official Restorebraine app icon -> ${destination1024}`);
  }
} catch (error) {
  if (existsSync(destination1024) && !usedBranded) {
    console.warn(`Official icon fetch failed (${error.message}); keeping existing AppIcon-1024.png`);
    process.exit(0);
  }
  console.warn(`Official icon fetch failed (${error.message}) — generating branded icon.`);
  await import('./generate-branded-app-icon.mjs');
}
