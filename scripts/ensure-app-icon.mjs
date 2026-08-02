import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const destination1024 = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png');

try {
  const { downloadOfficialIcon, normalizeIcon, OFFICIAL_APP_ICON_URL } = await import('./fetch-official-app-icon.mjs');
  await downloadOfficialIcon();
  await normalizeIcon();
  console.log(`Using official Restorebraine app icon -> ${destination1024}`);
  console.log(`Source: ${OFFICIAL_APP_ICON_URL}`);
} catch (error) {
  if (existsSync(destination1024)) {
    console.warn(`Official icon fetch failed (${error.message}); keeping existing AppIcon-1024.png`);
    process.exit(0);
  }
  console.warn(`Official icon fetch failed (${error.message}) — generating branded fallback.`);
  await import('./generate-branded-app-icon.mjs');
}
