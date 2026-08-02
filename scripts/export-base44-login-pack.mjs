#!/usr/bin/env node
/** Minimal Base44 paste pack — Sign In + signed-out landing (publish this FIRST). */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_APP_SHELL, TIER_OAUTH } from './base44-v87-publish-manifest.mjs';

const files = [...new Set([...TIER_APP_SHELL, ...TIER_OAUTH])];
const chunks = files.map((rel) => {
  const body = readFileSync(resolve(rel), 'utf8');
  return `\n${'='.repeat(72)}\nFILE: ${rel}\n${'='.repeat(72)}\n${body}`;
});

const out = resolve('BASE44-LOGIN-PACK-v87.txt');
writeFileSync(
  out,
  `# Restorebraine v87 LOGIN pack — paste into Base44, then Publish ONCE\n# ${files.length} files — fixes Sign In + signed-out landing\n${chunks.join('\n')}\n`,
);
console.log(`Wrote ${files.length} files → ${out}`);
console.log('');
import { spawnSync } from 'node:child_process';
spawnSync('node', ['scripts/print-base44-publish-steps.mjs', '--full'], { stdio: 'inherit' });
