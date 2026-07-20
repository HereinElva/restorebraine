#!/usr/bin/env node
/** Regenerate ios/App/App/ghost-builds.txt from registry (no network). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allGhostFilenames } from './ghost-builds-registry.mjs';

const outPath = resolve('ios/App/App/ghost-builds.txt');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${allGhostFilenames().join('\n')}\n`);
console.log(`Synced ${allGhostFilenames().length} ghost builds → ${outPath}`);
