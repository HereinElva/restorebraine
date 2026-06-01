import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const infoPlistPath = resolve('ios/App/App/Info.plist');
const requiredIphone = [
  { file: 'AppIcon-20@2x.png', pixels: 40 },
  { file: 'AppIcon-20@3x.png', pixels: 60 },
  { file: 'AppIcon-29@2x.png', pixels: 58 },
  { file: 'AppIcon-29@3x.png', pixels: 87 },
  { file: 'AppIcon-40@2x.png', pixels: 80 },
  { file: 'AppIcon-40@3x.png', pixels: 120 },
  { file: 'AppIcon-60@2x.png', pixels: 120 },
  { file: 'AppIcon-60@3x.png', pixels: 180 },
  { file: 'AppIcon-1024.png', pixels: 1024 },
];

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

for (const { file, pixels } of requiredIphone) {
  const path = resolve(iconDir, file);
  if (!existsSync(path)) {
    console.error(`FAIL: missing iOS app icon ${file}`);
    failed = true;
    continue;
  }
  const bytes = readFileSync(path).length;
  if (bytes < 200) {
    console.error(`FAIL: iOS app icon ${file} is too small (${bytes} bytes)`);
    failed = true;
    continue;
  }
  try {
    const meta = await sharp(path).metadata();
    if (meta.width !== pixels || meta.height !== pixels) {
      console.error(`FAIL: ${file} is ${meta.width}x${meta.height}, expected ${pixels}x${pixels}`);
      failed = true;
      continue;
    }
  } catch (error) {
    console.error(`FAIL: could not read ${file}: ${error.message}`);
    failed = true;
    continue;
  }
  if (file === 'AppIcon-1024.png' && bytes < 200000) {
    console.error(`FAIL: ${file} looks like a placeholder (${bytes} bytes) — run fetch-official-app-icon.mjs`);
    failed = true;
    continue;
  }
  console.log(`OK: ${file} (${bytes} bytes, ${pixels}x${pixels})`);
}

if (failed) {
  console.error('\nRun: node scripts/generate-ios-app-icons.mjs');
  process.exit(1);
}

console.log('\nAll required iPhone app icons present');
