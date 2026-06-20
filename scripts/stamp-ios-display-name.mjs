/**
 * Debug builds: home screen shows "RB v{N}" so device deploy is obvious without opening app.
 * Reverts to "Restorebraine" when --hosted is passed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const useLocal = process.argv.includes('--local');
const plistPath = resolve('ios/App/App/Info.plist');
const buildInfoPath = resolve('src/lib/build-info.js');
const buildNum = readFileSync(buildInfoPath, 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

const displayName = useLocal ? `RB v${buildNum}` : 'Restorebraine';
let plist = readFileSync(plistPath, 'utf8');

if (/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/.test(plist)) {
  plist = plist.replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${displayName}$2`,
  );
} else {
  plist = plist.replace(
    '<key>CFBundleDevelopmentRegion</key>',
    `<key>CFBundleDisplayName</key>\n\t<string>${displayName}</string>\n\t<key>CFBundleDevelopmentRegion</key>`,
  );
}

writeFileSync(plistPath, plist);
console.log(`Info.plist CFBundleDisplayName → "${displayName}"`);
