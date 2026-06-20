/**
 * Home screen label — always "Restorebraine" (version lives in in-app debug badge only).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const plistPath = resolve('ios/App/App/Info.plist');
const displayName = 'Restorebraine';
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
