#!/usr/bin/env node
/**
 * Scan live Base44 CDN for ghost builds — delegates to discover, then sync (keeps bundled ALLOW).
 * Usage: npm run ghosts:scan
 *
 * WARNING: Never run on Omega 7 restore without sync — use npm run ghosts:sync only.
 */
import { execSync } from 'node:child_process';
import { discoverGhostBuilds } from './discover-ghost-builds.mjs';

const report = await discoverGhostBuilds({ writeGhostFile: false });

console.log(`
═══════════════════════════════════════════════════════════════
 GHOST BUILD SCAN — ${report.live.index} → ${report.live.app}
═══════════════════════════════════════════════════════════════
 Live deps (ALLOW):  ${report.active.length}
 Device block (stale): ${report.deviceBlocklist.length}
 CDN ghosts HTTP 200: ${report.stats.cdnGhosts}
`);

console.log('==> Merging bundled ios/public ALLOW entries (required for Omega 7)...');
execSync('node scripts/sync-ghost-builds-native.mjs', { stdio: 'inherit' });

process.exit(report.falsePositiveInBlocklist?.length ? 2 : 0);
