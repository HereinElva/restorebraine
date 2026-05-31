import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const podspecPath = resolve('node_modules/@capgo/native-purchases/CapgoNativePurchases.podspec');

if (!existsSync(podspecPath)) {
  console.log('CapgoNativePurchases not installed — skipping podspec patch');
  process.exit(0);
}

let content = readFileSync(podspecPath, 'utf8');

if (content.includes('storekit_swift_flags = has_storekit_265_sdk?')) {
  console.log('CapgoNativePurchases.podspec already patched');
  process.exit(0);
}

// Undo broken :: prefix patch if present.
content = content.replace(
  "'OTHER_SWIFT_FLAGS' => ::has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'",
  "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'",
);

const brokenInline = "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'";
const fixedBlock = `'OTHER_SWIFT_FLAGS' => storekit_swift_flags`;

if (!content.includes(brokenInline)) {
  console.log('CapgoNativePurchases.podspec unchanged — no StoreKit 26.5 block to patch');
  process.exit(0);
}

content = content.replace(
  'Pod::Spec.new do |s|',
  `storekit_swift_flags = has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'\n\nPod::Spec.new do |s|`,
);
content = content.replace(brokenInline, fixedBlock);

writeFileSync(podspecPath, content);
console.log('Patched CapgoNativePurchases.podspec (hoist StoreKit flags before Pod::Spec.new)');
