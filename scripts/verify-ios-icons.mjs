import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const masterIcon = resolve(iconDir, 'AppIcon-1024.png');
const infoPlistPath = resolve('ios/App/App/Info.plist');

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const universal = contents.images?.find(
  (image) => image.idiom === 'universal' && image.size === '1024x1024' && image.filename
);

if (!universal) {
  console.error('FAIL: Contents.json must define one universal 1024x1024 AppIcon entry');
  failed = true;
} else {
  console.log(`OK: Contents.json references ${universal.filename}`);
}

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

if (!existsSync(masterIcon)) {
  console.error('FAIL: missing AppIcon-1024.png');
  failed = true;
} else {
  const bytes = readFileSync(masterIcon).length;
  try {
    const meta = await sharp(masterIcon).metadata();
    if (meta.width !== 1024 || meta.height !== 1024) {
      console.error(`FAIL: AppIcon-1024.png is ${meta.width}x${meta.height}, expected 1024x1024`);
      failed = true;
    } else if (bytes < 15000) {
      console.error(`FAIL: AppIcon-1024.png is too small (${bytes} bytes) — run npm run ios:icons`);
      failed = true;
    } else if (meta.hasAlpha) {
      console.error('FAIL: AppIcon-1024.png must not have transparency for App Store');
      failed = true;
    } else {
      console.log(`OK: AppIcon-1024.png (${bytes} bytes, 1024x1024, no alpha)`);
    }
  } catch (error) {
    console.error(`FAIL: could not read AppIcon-1024.png: ${error.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nRun: npm run ios:icons');
  process.exit(1);
}

console.log('\nSingle-size iOS AppIcon ready for Xcode');
