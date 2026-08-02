/** Button label during organize — only show batch progress, not merge/cleanup steps. */
export function normalizeOrganizeProgress(raw, lastBatch = '') {
  if (!raw) return lastBatch || 'Organizing…';

  const text = String(raw);
  const batchMatch = text.match(/batch\s+(\d+)\s*\/\s*(\d+)/i);
  if (batchMatch) return `Batch ${batchMatch[1]}/${batchMatch[2]}`;

  const saveMatch = text.match(/save\s+(\d+)\s*\/\s*(\d+)/i);
  if (saveMatch) return `Batch ${saveMatch[1]}/${saveMatch[2]}`;

  const groupMatch = text.match(/grouping batch\s+(\d+)\s*\/\s*(\d+)/i);
  if (groupMatch) return `Batch ${groupMatch[1]}/${groupMatch[2]}`;

  if (/grouping \d+ items/i.test(text)) return 'Batch 1/1';

  return lastBatch || 'Organizing…';
}
