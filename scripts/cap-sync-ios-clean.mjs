/**
 * Wipe stale ios/App/App/public, run cap sync, then force-mirror dist/.
 * @deprecated Prefer: node scripts/cap-merge-web-into-ios.mjs
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
execSync('node scripts/cap-merge-web-into-ios.mjs', { cwd: repo, stdio: 'inherit' });
