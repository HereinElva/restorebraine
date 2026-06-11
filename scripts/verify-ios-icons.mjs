import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const universalIcon = resolve(iconDir, 'AppIcon-512@2x.png');
const infoPlistPath = resolve('ios/App/App/Info.plist');

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const universalEntries = contents.images?.filter(
  (image) => image.idiom === 'universal' && image.size === '1024x1024'
) ?? [];

if (universalEntries.length < 1) {
  console.error('FAIL: Contents.json must define universal 1024x1024 AppIcon entries');
  failed = true;
} else {
  console.log(`OK: Contents.json has ${universalEntries.length} universal 1024x1024 entries`);
}

const defaultEntry = universalEntries.find((entry) => !entry.appearances?.length);
if (!defaultEntry?.filename) {
  console.error('FAIL: Contents.json missing default (Any Appearance) universal icon filename');
  failed = true;
} else {
  console.log(`OK: Any Appearance -> ${defaultEntry.filename}`);
}

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

if (!existsSync(universalIcon)) {
  console.error('FAIL: missing AppIcon-512@2x.png');
  failed = true;
} else {
  const bytes = readFileSync(universalIcon).length;
  try {
    const meta = await sharp(universalIcon).metadata();
    if (meta.width !== 1024 || meta.height !== 1024) {
      console.error(`FAIL: AppIcon-512@2x.png is ${meta.width}x${meta.height}, expected 1024x1024`);
      failed = true;
    } else if (bytes < 15000) {
      console.error(`FAIL: AppIcon-512@2x.png is too small (${bytes} bytes) — run npm run ios:icons`);
      failed = true;
    } else if (meta.hasAlpha) {
      console.error('FAIL: AppIcon-512@2x.png must not have transparency for App Store');
      failed = true;
    } else {
      console.log(`OK: AppIcon-512@2x.png (${bytes} bytes, 1024x1024, no alpha)`);
    }
  } catch (error) {
    console.error(`FAIL: could not read AppIcon-512@2x.png: ${error.message}`);
    failed = true;
  }
}

for (const entry of universalEntries) {
  if (!entry.filename) continue;
  if (!existsSync(resolve(iconDir, entry.filename))) {
    console.error(`FAIL: Contents.json references ${entry.filename} but file is missing`);
    failed = true;
  }
}

if (failed) {
  console.error('\nRun: npm run ios:icons');
  process.exit(1);
}

console.log('\nXcode 16 AppIcon ready (3 universal slots, one 1024 PNG)');
