import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const appStoreIcon = resolve(iconDir, 'appstore.png');
const masterIcon = resolve(iconDir, 'AppIcon-1024.png');
const infoPlistPath = resolve('ios/App/App/Info.plist');

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const marketing = contents.images?.find(
  (image) => image.idiom === 'ios-marketing' && image.size === '1024x1024' && image.filename
);

if (!marketing) {
  console.error('FAIL: Contents.json missing ios-marketing 1024x1024 entry');
  failed = true;
} else {
  console.log(`OK: Contents.json ios-marketing -> ${marketing.filename}`);
}

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

for (const [label, iconPath] of [['appstore.png', appStoreIcon], ['AppIcon-1024.png', masterIcon]]) {
  if (!existsSync(iconPath)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
    continue;
  }

  const bytes = readFileSync(iconPath).length;
  try {
    const meta = await sharp(iconPath).metadata();
    if (meta.width !== 1024 || meta.height !== 1024) {
      console.error(`FAIL: ${label} is ${meta.width}x${meta.height}, expected 1024x1024`);
      failed = true;
    } else if (bytes < 15000) {
      console.error(`FAIL: ${label} is too small (${bytes} bytes) — run npm run ios:icons`);
      failed = true;
    } else if (meta.hasAlpha) {
      console.error(`FAIL: ${label} must not have transparency for App Store`);
      failed = true;
    } else {
      console.log(`OK: ${label} (${bytes} bytes, 1024x1024, no alpha)`);
    }
  } catch (error) {
    console.error(`FAIL: could not read ${label}: ${error.message}`);
    failed = true;
  }
}

if (marketing && !existsSync(resolve(iconDir, marketing.filename))) {
  console.error(`FAIL: Contents.json references ${marketing.filename} but file is missing`);
  failed = true;
}

if (failed) {
  console.error('\nRun: npm run ios:icons');
  process.exit(1);
}

console.log('\niOS AppIcon ready for Xcode (1024pt App Store slot -> appstore.png)');
