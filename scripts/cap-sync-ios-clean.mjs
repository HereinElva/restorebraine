/**
 * Wipe stale ios/App/App/public before cap sync so Xcode always
 * copies the fresh Vite dist (cap sync alone does not delete orphan files).
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = resolve('ios/App/App/public');

if (existsSync(publicDir)) {
  const count = readdirSync(publicDir, { recursive: true }).length;
  if (count) {
    console.log(`Removing ios/App/App/public (${count} entries) before cap sync`);
  }
  rmSync(publicDir, { recursive: true, force: true });
}

console.log('Running cap sync ios (clean public/ first)...');
execSync('npx cap sync ios', { stdio: 'inherit' });
execSync('node scripts/register-local-ios-plugins.mjs', { stdio: 'inherit' });
