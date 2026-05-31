import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    path: 'ios/App/App/BUILD_STAMP.txt',
    test: (content) => content.includes('kbrown native v'),
    message: 'BUILD_STAMP.txt is missing or outdated',
  },
  {
    path: 'ios/App/App/public/index.html',
    test: (content) => content.includes('__restorebraineOAuthFixInstalled'),
    message: 'ios/App/App/public/index.html is missing the OAuth fix',
  },
  {
    path: 'ios/App/App/capacitor.config.json',
    test: (content) => !content.includes('app.base44.com') && content.includes('restorebraine.base44.app'),
    message: 'ios/App/App/capacitor.config.json still allows Base44 platform in WebView',
  },
  {
    path: 'ios/App/App/public/assets',
    test: () => existsSync(resolve('ios/App/App/public/assets')),
    message: 'ios/App/App/public/assets is missing — run npm run build',
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
