/** Ensure local iOS Capacitor plugins stay registered after cap sync. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Build v4 OAuth runs via restorebraine-v4-bridge.js + InAppBrowser — no custom plugin.
const LOCAL_PLUGINS = [];

for (const relPath of ['ios/App/App/capacitor.config.json', 'capacitor.config.json']) {
  const configPath = resolve(relPath);
  if (!existsSync(configPath)) continue;
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const list = new Set([...(config.packageClassList || []), ...LOCAL_PLUGINS]);
  config.packageClassList = [...list];
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Registered local iOS plugins in ${relPath}`);
}
