import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const useLocal = process.argv.includes('--local');
const paths = [
  resolve('capacitor.config.json'),
  resolve('ios/App/App/capacitor.config.json'),
];

for (const configPath of paths) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  if (useLocal) {
    delete config.server;
    console.log(`Local bundle mode: removed server.url from ${configPath}`);
  } else {
    config.server = {
      url: 'https://restorebraine.base44.app',
      cleartext: false,
      allowNavigation: [
        'restorebraine.base44.app',
        'restorebraine.com',
        'www.restorebraine.com',
        'app.base44.com',
        'accounts.google.com',
        'appleid.apple.com',
        'checkout.stripe.com',
        'pay.stripe.com',
        'stripe.com',
        'js.stripe.com',
        'm.stripe.com',
        'hooks.stripe.com',
      ],
    };
    console.log(`Hosted mode: restored server.url in ${configPath}`);
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
