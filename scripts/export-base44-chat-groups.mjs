#!/usr/bin/env node
/**
 * Chat-sized paste groups for Base44 AI — DIRECT paste only (no URL fetch).
 * URL fetch through Base44 markdown filter destroys JSX — known dead-end.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASE44_ALREADY_SAVED,
  BASE44_REMAINING,
  TIER_FULL,
  githubRawUrl,
} from './base44-v87-publish-manifest.mjs';

const MAX_GROUP_BYTES = 10000;
const OUT = resolve('base44-paste-chat');
const PROMPT = `Apply every FILE block below to the Restorebraine code editor.
Write each file at the exact path shown — replace entire file contents.
Do NOT Publish until I confirm all chat groups are done.
Do NOT fetch URLs — paste content only (JSX must stay intact).`;

function formatFile(rel) {
  const body = readFileSync(resolve(rel), 'utf8');
  return `\n${'='.repeat(72)}\nFILE: ${rel}\n${'='.repeat(72)}\n${body}`;
}

mkdirSync(OUT, { recursive: true });

const groups = [];
let current = { files: [], bytes: PROMPT.length + 200 };

for (const rel of BASE44_REMAINING) {
  const block = formatFile(rel);
  const size = block.length;
  if (current.files.length && current.bytes + size > MAX_GROUP_BYTES) {
    groups.push(current);
    current = { files: [], bytes: PROMPT.length + 200 };
  }
  current.files.push({ rel, block, size });
  current.bytes += size;
}
if (current.files.length) groups.push(current);

groups.forEach((g, i) => {
  const num = String(i + 1).padStart(2, '0');
  const header = `# Base44 chat paste ${i + 1}/${groups.length} (${g.files.length} files)\n\n${PROMPT}\n\nFiles in this message:\n${g.files.map((f, j) => `${j + 1}. ${f.rel}`).join('\n')}\n`;
  const body = g.files.map((f) => f.block).join('\n');
  writeFileSync(resolve(OUT, `CHAT-${num}.txt`), header + body);
});

const rawUrls = BASE44_REMAINING.map((rel) => `${rel}\t${githubRawUrl(rel)}`).join('\n');
writeFileSync(resolve(OUT, 'RAW-GITHUB-SOURCE-URLS.txt'), `# Test ONE raw source URL at a time in Base44 (NOT .txt batches)\n# If JSX still mangles, use CHAT-*.txt direct paste instead\n\n${rawUrls}\n`);

const readme = `# Direct paste for Base44 AI (${BASE44_REMAINING.length} remaining files)

## DO NOT USE
- GitHub batch .txt URL fetch — markdown filter destroys JSX (known dead-end)
- Wrapped batch files from base44-paste-batches/

## Already saved in Base44 (${BASE44_ALREADY_SAVED.length} files — skip)
${BASE44_ALREADY_SAVED.map((f) => `- ${f}`).join('\n')}

## Remaining: ${BASE44_REMAINING.length} files in ${groups.length} chat messages

Reply to Base44:
"I will paste ${groups.length} chat groups directly — no URL fetch. Do not Publish until group ${groups.length}."

For each CHAT-XX.txt:
  cat ~/restorebraine/base44-paste-chat/CHAT-01.txt | pbcopy
  → paste entire contents into Base44 chat
  → wait for Base44 to write files
  → repeat CHAT-02 … CHAT-${String(groups.length).padStart(2, '0')}

After last group:
  "All groups applied. Publish once now."

Mac verify:
  npm run align:watch
  npm run diagnose:chunks

## Optional: test raw GitHub source (one file)
See RAW-GITHUB-SOURCE-URLS.txt — e.g. test Gallery.jsx URL only
`;

writeFileSync(resolve(OUT, 'README.txt'), readme);

console.log(`Already in Base44: ${BASE44_ALREADY_SAVED.length} files`);
console.log(`Remaining:       ${BASE44_REMAINING.length} files`);
console.log(`Chat groups:     ${groups.length} messages → ${OUT}/`);
groups.forEach((g, i) => {
  console.log(`  CHAT-${String(i + 1).padStart(2, '0')}.txt  ${g.files.length} files  ~${Math.round(g.bytes / 1024)}KB`);
});
