import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const podspecPath = resolve('node_modules/@capgo/native-purchases/CapgoNativePurchases.podspec');
const PATCH_MARKER = '# restorebraine-podspec-patch-v2';

if (!existsSync(podspecPath)) {
  console.log('CapgoNativePurchases not installed — skipping podspec patch');
  process.exit(0);
}

const content = readFileSync(podspecPath, 'utf8');

if (content.includes(PATCH_MARKER)) {
  console.log('CapgoNativePurchases.podspec already patched');
  process.exit(0);
}

// CocoaPods evaluates podspecs in the Pod module context, so helper methods like
// has_storekit_265_sdk? fail even when hoisted. Use the pre-8.4 podspec shape instead.
const fixedPodspec = `require 'json'
${PATCH_MARKER}

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapgoNativePurchases'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url']
  s.author = package['author']
  s.source = { :git => package['repository']['url'], :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.exclude_files = '**/node_modules/**/*', '**/examples/**/*'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
`;

writeFileSync(podspecPath, fixedPodspec);
console.log('Patched CapgoNativePurchases.podspec (removed broken StoreKit 26.5 helper)');
