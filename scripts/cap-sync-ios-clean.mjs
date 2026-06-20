/**
 * Wipe stale ios/App/App/public assets before cap sync so Xcode always
 * copies the fresh Vite dist (cap sync alone does not delete orphan files).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = resolve('ios/App/App/public');
const assetsDir = resolve(publicDir, 'assets');

if (existsSync(assetsDir)) {
  const orphans = readdirSync(assetsDir);
  if (orphans.length) {
    console.log(`Removing ${orphans.length} stale file(s) from ios/App/App/public/assets`);
  }
  rmSync(assetsDir, { recursive: true, force: true });
}
mkdirSync(assetsDir, { recursive: true });

console.log('Running cap sync ios (clean public/assets first)...');
execSync('npx cap sync ios', { stdio: 'inherit' });
