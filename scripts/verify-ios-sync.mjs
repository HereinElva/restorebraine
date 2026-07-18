import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const hasOAuthFixInBundle = () => {
  const assetsDir = resolve('ios/App/App/public/assets');
  return readdirSync(assetsDir).some(
    (file) => file.endsWith('.js') && readFileSync(join(assetsDir, file), 'utf8').includes('__restorebraineOAuthFixInstalled'),
  );
};

const hasBadLoginUrlInBundle = () => {
  const assetsDir = resolve('ios/App/App/public/assets');
  return readdirSync(assetsDir).some((file) => {
    if (!file.endsWith('.js')) return false;
    const content = readFileSync(join(assetsDir, file), 'utf8');
    return content.includes('app.base44.com/login') || content.includes('68fdc53372ff0fbf07eee38d');
  });
};

const isLocalBundleMode = process.env.CAPACITOR_LOCAL === '1';

const checks = [
  {
    path: 'ios/App/App/BUILD_STAMP.txt',
    test: (content) => content.includes('kbrown native v'),
    message: 'BUILD_STAMP.txt is missing or outdated',
  },
  ...(isLocalBundleMode
    ? []
    : [
        {
          path: 'capacitor.config.json',
          test: (content) => /"url"\s*:\s*"https:\/\/restorebraine\.base44\.app"/.test(content),
          message: 'capacitor.config.json must set server.url to hosted Restorebraine app',
        },
        {
          path: 'ios/App/App/capacitor.config.json',
          test: (content) => /"url"\s*:\s*"https:\/\/restorebraine\.base44\.app"/.test(content),
          message: 'ios/App/App/capacitor.config.json must set server.url — run npm run build',
        },
      ]),
  {
    path: 'ios/App/App/public/assets',
    test: () => hasOAuthFixInBundle(),
    message: 'Bundled assets are missing the OAuth fix',
  },
  {
    path: 'ios/App/App/public/assets',
    test: () => !hasBadLoginUrlInBundle(),
    message: 'Bundled assets contain hardcoded app.base44.com/login URLs — rebuild required',
  },
  {
    path: 'ios/App/App/capacitor.config.json',
    test: (content) =>
      isLocalBundleMode
        ? !/"url"\s*:/.test(content)
        : content.includes('restorebraine.base44.app') && content.includes('accounts.google.com'),
    message: isLocalBundleMode
      ? 'local bundle mode should not set server.url'
      : 'ios/App/App/capacitor.config.json missing required OAuth allowNavigation hosts',
  },
  {
    path: 'ios/App/App/public/assets',
    test: () => existsSync(resolve('ios/App/App/public/assets')),
    message: 'ios/App/App/public/assets is missing — run npm run build',
  },
  {
    path: 'ios/App/App/Info.plist',
    test: (content) =>
      content.includes('NSCameraUsageDescription') &&
      content.includes('Restorebraine uses the camera when you choose Take Photo') &&
      content.includes('NSPhotoLibraryUsageDescription') &&
      content.includes('organize them into folders'),
    message:
      'Info.plist missing App Store–compliant privacy usage descriptions — see ios/App/App/Info.plist',
  },
];

let failed = false;

for (const check of checks) {
  const filePath = resolve(check.path);
  if (!existsSync(filePath)) {
    console.error(`FAIL: ${check.message} (${check.path})`);
    failed = true;
    continue;
  }

  const content = check.path.endsWith('/assets') ? '' : readFileSync(filePath, 'utf8');
  if (!check.test(content)) {
    console.error(`FAIL: ${check.message} (${check.path})`);
    failed = true;
    continue;
  }

  console.log(`OK: ${check.path}`);
}

if (failed) {
  console.error('\nRun: npm run build');
  process.exit(1);
}

const stamp = readFileSync(resolve('ios/App/App/BUILD_STAMP.txt'), 'utf8').trim();
console.log(`\nXcode bundle ready: ${stamp}`);
