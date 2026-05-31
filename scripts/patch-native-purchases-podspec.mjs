import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const podspecPath = resolve('node_modules/@capgo/native-purchases/CapgoNativePurchases.podspec');

if (!existsSync(podspecPath)) {
  console.log('CapgoNativePurchases not installed — skipping podspec patch');
  process.exit(0);
}

let content = readFileSync(podspecPath, 'utf8');
const broken = "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ?";
const fixed = "'OTHER_SWIFT_FLAGS' => ::has_storekit_265_sdk? ?";

if (content.includes(fixed)) {
  console.log('CapgoNativePurchases.podspec already patched');
  process.exit(0);
}

if (!content.includes(broken)) {
  console.log('CapgoNativePurchases.podspec unchanged — no StoreKit 26.5 block to patch');
  process.exit(0);
}

content = content.replace(broken, fixed);
writeFileSync(podspecPath, content);
console.log('Patched CapgoNativePurchases.podspec (fix CocoaPods method lookup)');
