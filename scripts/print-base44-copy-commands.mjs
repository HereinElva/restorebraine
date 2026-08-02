#!/usr/bin/env node
/** Print Mac copy commands for each Base44 nuke-list file (paste workflow). */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_FULL } from './base44-v87-publish-manifest.mjs';

const root = resolve('.');
const sha = (rel) => createHash('sha256').update(readFileSync(resolve(rel))).digest('hex').slice(0, 12);

console.log(`# Restorebraine v87 — paste workflow (${TIER_FULL.length} files)`);
console.log('# Open Base44 code editor. For each file: open path → paste → save.');
console.log('# After ALL files saved → Publish ONCE → npm run diagnose:chunks\n');

TIER_FULL.forEach((rel, i) => {
  const n = String(i + 1).padStart(2, '0');
  console.log(`# ${n}. ${rel}  (sha ${sha(rel)})`);
  console.log(`cat "${root}/${rel}" | pbcopy`);
  console.log('');
});

console.log('# After Publish on Base44:');
console.log('npm run diagnose:chunks');
console.log('npm run diagnose:all');
