#!/usr/bin/env node
/** Write all v87 Base44 paste files into one text file for manual copy. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_OAUTH, TIER_APP_SHELL } from './base44-v87-publish-manifest.mjs';

const files = [...new Set([...TIER_OAUTH, ...TIER_APP_SHELL])];
const chunks = files.map((rel) => {
  const body = readFileSync(resolve(rel), 'utf8');
  return `\n${'='.repeat(72)}\nFILE: ${rel}\n${'='.repeat(72)}\n${body}`;
});

const out = resolve('BASE44-PASTE-PACK-v87.txt');
writeFileSync(out, `# Restorebraine v87 Base44 paste pack\n# Paste each FILE block into Base44 code editor, then Publish once.\n${chunks.join('\n')}\n`);
console.log(`Wrote ${files.length} files → ${out}`);
