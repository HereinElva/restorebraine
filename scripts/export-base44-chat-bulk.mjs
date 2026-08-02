#!/usr/bin/env node
/** Concatenate CHAT-10 … CHAT-34 into one bulk paste file for Base44. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve('base44-paste-chat');
const out = resolve(dir, 'CHAT-10-34-ALL.txt');

const chats = readdirSync(dir)
  .filter((f) => /^CHAT-\d+\.txt$/.test(f))
  .sort((a, b) => Number(a.slice(5, 7)) - Number(b.slice(5, 7)))
  .filter((f) => Number(f.slice(5, 7)) >= 10);

if (chats.length === 0) {
  console.error('No CHAT-10+ files found. Run: npm run base44:export-chat');
  process.exit(1);
}

const header = `# Base44 bulk paste — groups 10-${String(9 + chats.length).padStart(2, '0')}/34

Apply EVERY FILE block below to the Restorebraine code editor.
Write each file at the exact path shown — replace entire file contents.
Process all groups in order (10 through ${9 + chats.length}).
Do NOT Publish until I confirm all 34 chat groups are done.
Do NOT fetch URLs — paste content only (JSX must stay intact).

After all files are written, reply: "Groups 10-${9 + chats.length} applied. Waiting for Publish."

`;

const body = chats
  .map((name, i) => {
    const n = Number(name.slice(5, 7));
    const content = readFileSync(resolve(dir, name), 'utf8').trimEnd();
    return `${'='.repeat(72)}\n# BEGIN GROUP ${n}/34 (${name})\n${'='.repeat(72)}\n\n${content}`;
  })
  .join('\n\n');

writeFileSync(out, header + body + '\n', 'utf8');

const bytes = Buffer.byteLength(header + body, 'utf8');
console.log(`Wrote ${out}`);
console.log(`  ${chats.length} groups · ~${Math.round(bytes / 1024)} KB`);
console.log('');
console.log('Mac — copy entire bulk paste to clipboard:');
console.log(`  cat "${out}" | pbcopy`);
