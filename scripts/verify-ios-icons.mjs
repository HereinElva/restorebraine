import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const iconDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset');
const contentsPath = resolve(iconDir, 'Contents.json');
const infoPlistPath = resolve('ios/App/App/Info.plist');

const requiredFiles = [
  'Icon-Any-1024.png',
  'Icon-Dark-1024.png',
  'Icon-Tinted-1024.png',
  'AppIcon-512@2x.png',
];

let failed = false;

if (!existsSync(contentsPath)) {
  console.error('FAIL: AppIcon.appiconset/Contents.json missing');
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const universalEntries = contents.images?.filter(
  (image) => image.idiom === 'universal' && image.size === '1024x1024'
) ?? [];

if (universalEntries.length < 3) {
  console.error(`FAIL: Contents.json needs 3 universal entries, found ${universalEntries.length}`);
  failed = true;
} else {
  console.log(`OK: Contents.json has ${universalEntries.length} universal 1024x1024 entries`);
}

for (const entry of universalEntries) {
  if (!entry.filename) {
    console.error('FAIL: universal entry missing filename');
    failed = true;
    continue;
  }
  console.log(`OK: ${entry.appearances?.[0]?.value ?? 'any'} -> ${entry.filename}`);
}

const infoPlist = readFileSync(infoPlistPath, 'utf8');
if (!infoPlist.includes('<key>CFBundleIconName</key>') || !infoPlist.includes('<string>AppIcon</string>')) {
  console.error('FAIL: Info.plist missing CFBundleIconName = AppIcon');
  failed = true;
} else {
  console.log('OK: Info.plist CFBundleIconName = AppIcon');
}

if (infoPlist.includes('<key>CFBundleIcons</key>')) {
  console.error('FAIL: Info.plist must not contain CFBundleIcons (conflicts with asset catalog)');
  failed = true;
} else {
  console.log('OK: Info.plist has no CFBundleIcons override');
}

for (const filename of requiredFiles) {
  const iconPath = resolve(iconDir, filename);
  if (!existsSync(iconPath)) {
    console.error(`FAIL: missing ${filename}`);
    failed = true;
    continue;
  }

  const bytes = readFileSync(iconPath).length;
  try {
    const meta = await sharp(iconPath).metadata();
    if (meta.width !== 1024 || meta.height !== 1024) {
      console.error(`FAIL: ${filename} is ${meta.width}x${meta.height}, expected 1024x1024`);
      failed = true;
    } else if (bytes < 15000) {
      console.error(`FAIL: ${filename} is too small (${bytes} bytes)`);
      failed = true;
    } else if (meta.hasAlpha) {
      console.error(`FAIL: ${filename} must not have transparency`);
      failed = true;
    } else {
      console.log(`OK: ${filename} (${bytes} bytes)`);
    }
  } catch (error) {
    console.error(`FAIL: could not read ${filename}: ${error.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nRun: npm run ios:icons');
  process.exit(1);
}

console.log('\nAppIcon ready for App Store archive');
