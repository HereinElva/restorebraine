#!/usr/bin/env node
/**
 * Export one FILE block per text file — fits Base44 AI chat paste limits.
 * Usage: npm run base44:export-one-file
 *        npm run base44:copy-file -- 1     (prints copy command for file #1)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_FULL } from './base44-v87-publish-manifest.mjs';

const OUT = resolve('base44-paste-one-file');
mkdirSync(OUT, { recursive: true });

const manifest = [];

TIER_FULL.forEach((rel, i) => {
  const n = String(i + 1).padStart(3, '0');
  const safe = rel.replace(/\//g, '__');
  const body = readFileSync(resolve(rel), 'utf8');
  const content = `# Paste this ENTIRE message into Base44 AI chat (file ${i + 1}/${TIER_FULL.length})

Apply this single file to the Restorebraine code editor. Do NOT Publish yet.

========================================================================
FILE: ${rel}
========================================================================
${body}`;
  const name = `${n}-${safe}.txt`;
  writeFileSync(resolve(OUT, name), content);
  manifest.push({ num: i + 1, rel, name });
});

const readme = `# One file per Base44 AI message (${TIER_FULL.length} files)

Base44 chat often drops large pastes. Send ONE of these files per message.

## Prompt (paste first line of each file, or use this):

Apply the FILE block below to the Restorebraine code editor at the exact path shown.
Replace entire file contents. Do NOT Publish until all ${TIER_FULL.length} files are done.

## Copy on Mac:

${manifest.map((m) => `cat ~/restorebraine/base44-paste-one-file/${m.name} | pbcopy  # ${m.num}. ${m.rel}`).join('\n')}

## After all ${TIER_FULL.length} files written in Base44:

Tell Base44: "All files applied. Publish once now."
Mac: npm run align:watch
`;

writeFileSync(resolve(OUT, 'README.txt'), readme);
console.log(`Wrote ${TIER_FULL.length} single-file paste blocks → ${OUT}/`);
console.log('Use when Base44 says "No file blocks came through" — paste ONE file per chat message.');
