import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    path: 'android/version.properties',
    test: (content) => /VERSION_CODE=\d+/.test(content) && /VERSION_NAME=/.test(content),
    message: 'android/version.properties is missing or invalid',
  },
  {
    path: 'android/app/src/main/assets/capacitor.config.json',
    test: (content) => content.includes('restorebraine.base44.app') && content.includes('accounts.google.com'),
    message: 'Synced Android capacitor.config.json missing required OAuth allowNavigation hosts',
  },
  {
    path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
    test: () => true,
    message: 'Android launcher icon missing — run: npm run android:icons',
  },
  {
    path: 'src/lib/build-info.js',
    test: (content) => content.includes('kbrown native v'),
    message: 'build-info.js is missing or outdated',
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

  const content = readFileSync(filePath, 'utf8');
  if (!check.test(content)) {
    console.error(`FAIL: ${check.message} (${check.path})`);
    failed = true;
    continue;
  }

  console.log(`OK: ${check.path}`);
}

if (failed) {
  console.error('\nRun: npm run build:android');
  process.exit(1);
}

const version = readFileSync(resolve('android/version.properties'), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('VERSION_NAME='))
  ?.split('=')[1]
  ?.trim();
console.log(`\nAndroid bundle ready: Restorebraine ${version ?? 'unknown'}`);
