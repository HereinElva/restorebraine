#!/usr/bin/env node
/** Print one batch to stdout for pasting into Base44 AI chat. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const n = Number(process.argv[2] ?? process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1] ?? 0);
const dir = resolve('base44-paste-batches');
const files = readdirSync(dir)
  .filter((f) => f.startsWith('BASE44-BATCH-') && f.endsWith('.txt'))
  .sort();

if (!n || n < 1 || n > files.length) {
  console.error(`Usage: npm run base44:print-batch -- <1-${files.length}>`);
  console.error('\nBatches:');
  files.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exit(1);
}

const path = resolve(dir, files[n - 1]);
process.stdout.write(readFileSync(path, 'utf8'));
