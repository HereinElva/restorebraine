#!/usr/bin/env node
/** Print copy command for next chat paste group or list remaining files. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASE44_ALREADY_SAVED,
  BASE44_REMAINING,
  githubRawUrl,
} from './base44-v87-publish-manifest.mjs';

const arg = process.argv[2] ?? 'help';
const dir = resolve('base44-paste-chat');

if (arg === 'help' || arg === '-h') {
  console.log(`
Base44 direct paste — NO URL fetch (JSX mangling dead-end)

Already saved in Base44 (${BASE44_ALREADY_SAVED.length}):
${BASE44_ALREADY_SAVED.map((f) => `  ✓ ${f}`).join('\n')}

Remaining (${BASE44_REMAINING.length} files):
  npm run base44:remaining -- list
  npm run base44:remaining -- chat 1    # copy CHAT-01.txt to clipboard (Mac)
  npm run base44:remaining -- raw Gallery.jsx   # print raw GitHub URL for one file

Generate chat groups:
  npm run base44:export-chat

Bulk paste (groups 10-34):
  npm run base44:paste-rest
  cat base44-paste-chat/CHAT-10-34-ALL.txt | pbcopy
`);
  process.exit(0);
}

if (arg === 'list') {
  console.log(`Remaining ${BASE44_REMAINING.length} files:\n`);
  BASE44_REMAINING.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f}`));
  process.exit(0);
}

if (arg === 'raw' && process.argv[3]) {
  const needle = process.argv[3];
  const match = BASE44_REMAINING.find((f) => f.includes(needle))
    ?? BASE44_ALREADY_SAVED.find((f) => f.includes(needle));
  if (!match) {
    console.error(`No file matching: ${needle}`);
    process.exit(1);
  }
  console.log(githubRawUrl(match));
  console.log('\nTest this ONE URL in Base44. If JSX mangles, use direct CHAT paste instead.');
  process.exit(0);
}

const n = Number(arg === 'chat' ? process.argv[3] : arg);
if (!existsSync(dir)) {
  console.error('Run: npm run base44:export-chat');
  process.exit(1);
}
const chats = readdirSync(dir).filter((f) => f.startsWith('CHAT-') && f.endsWith('.txt')).sort();
if (!n || n < 1 || n > chats.length) {
  console.error(`Usage: npm run base44:remaining -- chat <1-${chats.length}>`);
  chats.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exit(1);
}

const file = resolve(dir, chats[n - 1]);
console.log(`# Copy to clipboard (Mac):`);
console.log(`cat "${file}" | pbcopy`);
console.log(`\n# Then paste ENTIRE contents into Base44 AI chat (message ${n}/${chats.length})`);
console.log(`# Files in this group — see top of ${chats[n - 1]}`);
