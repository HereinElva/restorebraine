import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const requiredIphone = [
  'AppIcon-20@2x.png',
  'AppIcon-20@3x.png',
  'AppIcon-29@2x.png',
  'AppIcon-29@3x.png',
  'AppIcon-40@2x.png',
  'AppIcon-40@3x.png',
  'AppIcon-60@2x.png',
  'AppIcon-60@3x.png',
  'AppIcon-1024.png',
];

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

for (const file of requiredIphone) {
  const path = resolve(iconDir, file);
  if (!existsSync(path)) {
    console.error(`FAIL: missing iOS app icon ${file}`);
    failed = true;
    continue;
  }
  const size = readFileSync(path).length;
  if (size < 200) {
    console.error(`FAIL: iOS app icon ${file} is too small (${size} bytes)`);
    failed = true;
    continue;
  }
  console.log(`OK: ${file} (${size} bytes)`);
}

if (failed) {
  console.error('\nRun: node scripts/generate-ios-app-icons.mjs');
  process.exit(1);
}

console.log('\nAll required iPhone app icons present');
