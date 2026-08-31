import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const marketingIcon = resolve(iconDir, 'AppIcon-1024.png');
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
  console.log(`OK: App Store 1024pt slot -> ${marketing.filename}`);
}

const deviceIcons = contents.images?.filter((image) => image.idiom !== 'ios-marketing') ?? [];
console.log(`OK: ${deviceIcons.length} iPhone/iPad icon slots defined`);

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

if (infoPlist.includes('<key>CFBundleIcons</key>')) {
  console.error('FAIL: Info.plist must not contain CFBundleIcons');
  failed = true;
}

for (const image of contents.images ?? []) {
  if (!image.filename) continue;
  const iconPath = resolve(iconDir, image.filename);
  if (!existsSync(iconPath)) {
    console.error(`FAIL: missing ${image.filename}`);
    failed = true;
  }
}

if (!existsSync(marketingIcon)) {
  console.error('FAIL: missing AppIcon-1024.png');
  failed = true;
} else {
  const bytes = readFileSync(marketingIcon).length;
  const meta = await sharp(marketingIcon).metadata();
  if (meta.width !== 1024 || meta.height !== 1024 || meta.hasAlpha || bytes < 15000) {
    console.error('FAIL: AppIcon-1024.png invalid for App Store');
    failed = true;
  } else {
    console.log(`OK: AppIcon-1024.png (${bytes} bytes, 1024x1024)`);
  }
}

if (failed) {
  console.error('\nRun: npm run ios:icons');
  process.exit(1);
}

console.log('\nClassic AppIcon grid ready for Xcode (look for App Store iOS 1024pt at bottom)');
