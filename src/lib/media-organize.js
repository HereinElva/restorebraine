import { isWeakMetadata } from '@/lib/media-tags';
import { normalizePhotoId } from '@/lib/gallery-organize-snapshot';

export const TARGET_FOLDERS_PER_RUN = 8;
export const ORGANIZE_BATCH_SIZE = 24;

export const CANONICAL_FOLDERS = [
  'People & Portraits',
  'Outdoor Activities',
  'Food & Dining',
  'Travel & Landmarks',
  'Celebrations & Events',
  'Home & Indoor',
  'Nature & Landscapes',
  'Animals & Pets',
  'Quotes & Text Screenshots',
  'Artwork & Illustrations',
  'Miscellaneous',
];

export function photoDataForOrganize(photo) {
  const tags = (photo.ai_tags || []).slice(0, 35);
  const desc = (photo.ai_description || '').trim();
  return {
    id: String(photo.id),
    type: photo.file_type || 'image',
    desc: desc.substring(0, 520),
    tags,
    top_tags: tags.slice(0, 15),
    weak: isWeakMetadata(photo),
  };
}

export function buildFolderOptions(existingFolderNames = [], customFolderHints = []) {
  const seen = new Set();
  const options = [];

  for (const name of [...existingFolderNames, ...customFolderHints, ...CANONICAL_FOLDERS]) {
    const trimmed = (name || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(trimmed);
  }

  return options;
}

/** Pull likely custom folder names / themes from user instructions. */
export function parseCustomFolderHints(customInstructions = '') {
  if (!customInstructions?.trim()) return [];

  const hints = new Set();
  const text = customInstructions.trim();

  const quoted = text.match(/["']([^"']{2,48})["']/g) || [];
  for (const q of quoted) {
    hints.add(q.replace(/["']/g, '').trim());
  }

  const folderLike = text.match(/\bfolder[s]?\s+(?:called|named|for)\s+["']?([^"'\n.,;]+)/gi) || [];
  for (const m of folderLike) {
    const name = m.split(/\s+(?:called|named|for)\s+/i)[1]?.trim();
    if (name) hints.add(name.replace(/["']/g, ''));
  }

  const groupPatterns = [
    /group\s+(?:all\s+)?(.+?)\s+(?:together|into|in)/gi,
    /keep\s+(.+?)\s+separate/gi,
    /put\s+(?:all\s+)?(.+?)\s+(?:together|in)/gi,
  ];
  for (const re of groupPatterns) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const phrase = match[1]?.trim();
      if (phrase && phrase.length <= 40) hints.add(phrase);
    }
  }

  return [...hints].filter(Boolean);
}

export const ORGANIZE_LABEL_RULES = `GROUP BY WHAT ITEMS LOOK LIKE — read desc + tags carefully:

• Grass, fields, meadows, farms, skies, mountains, beaches, plants, flowers, lakes → "Nature & Landscapes"
• Faces, selfies, groups, family, portraits, people → "People & Portraits"
• Dogs, cats, birds, wildlife, pets → "Animals & Pets"
• Meals, restaurants, drinks, cooking, groceries → "Food & Dining"
• Landmarks, cities, vacations, monuments, airports, architecture → "Travel & Landmarks"
• Parties, birthdays, weddings, holidays, concerts → "Celebrations & Events"
• Rooms, furniture, kitchen, bedroom, indoor spaces → "Home & Indoor"
• Sports, hiking, gym, biking, running, swimming, athletics → "Outdoor Activities"
• Screenshots, quotes, text, memes, documents, calendars → "Quotes & Text Screenshots"
• Art, drawings, paintings, illustrations, cartoons, retro graphics → "Artwork & Illustrations"
• Videos: classify by what is shown in the described scenes, not by "video" alone

Items with the same visible subject, setting, or activity belong in the SAME folder.`;

export function buildLabelPrompt({ photoData, folderOptions, customInstructions, targetFolderCount = TARGET_FOLDERS_PER_RUN }) {
  const customBlock = customInstructions?.trim()
    ? `
USER INSTRUCTIONS — ABSOLUTE HIGHEST PRIORITY (override default rules above):
${customInstructions.trim()}

Instruction rules:
- Follow user grouping exactly (by date, vacation, subject, location, etc.) when specified.
- You MAY create new folder names if instructions require names not in the list.
- If instructions mention specific subjects ("grass", "beach", "pets"), group ALL matching items together.
- Every item in this batch must receive a folder — do not skip any id.
`
    : `
- Sort this batch into exactly ${targetFolderCount} distinct folder names — each name used only once in this batch.
- Spread items evenly (at least 2 items per folder when the batch has ${targetFolderCount * 2}+ items).
- Use specific descriptive names (e.g. "Beach sunsets", "Family portraits") — never put everything in one folder.
- Every item MUST receive a folder — do not skip any id.
`;

  return `You organize a photo/video library by PHYSICAL VISUAL CONTENT.

Assign each item to exactly ONE folder based on its description and tags.

SUGGESTED FOLDER THEMES (use these or create similarly specific new names):
${folderOptions.map((n) => `- "${n}"`).join('\n')}

${ORGANIZE_LABEL_RULES}

RULES:
- This batch requires exactly ${targetFolderCount} different folder names.
- Return exactly ${photoData.length} labels — one per item, every id covered.
- Read the FULL desc field — it describes what is visible.
- weak:true items have less reliable tags — rely more on desc.
- Videos: use scene content from description, not the word "video" alone.
${customBlock}

Items: ${JSON.stringify(photoData)}

Return JSON: { "labels": [{ "id": "...", "folder": "..." }, ...] }`;
}

export function buildMergePrompt({ groups, existingFolderNames, customInstructions }) {
  return `Consolidate folder groups by visual similarity. Merge near-duplicates.

EXISTING FOLDER NAMES:
${existingFolderNames.map((n) => `- "${n}"`).join('\n')}

When user instructions specify grouping, follow them over default rules.
Every photo ID must appear exactly once in the output.
${customInstructions ? `\nUSER INSTRUCTIONS (highest priority):\n${customInstructions}` : ''}

Groups: ${JSON.stringify(groups)}

Return JSON: { "folders": [{ "name": "...", "ids": ["..."] }, ...] }`;
}

/** Keyword → canonical folder for local organize fallback. */
export const FOLDER_KEYWORD_MAP = {
  'Nature & Landscapes': [
    'grass', 'field', 'meadow', 'lawn', 'pasture', 'nature', 'landscape', 'sky', 'forest',
    'beach', 'mountain', 'flower', 'lake', 'tree', 'outdoor', 'garden', 'plant', 'sunset',
    'sunrise', 'hill', 'river', 'scenery', 'wildflower', 'meadows', 'greenery',
  ],
  'People & Portraits': [
    'people', 'portrait', 'selfie', 'face', 'family', 'friend', 'baby', 'child', 'person',
    'group', 'smile', 'headshot', 'couple', 'wedding', 'bride', 'groom', 'man', 'woman',
  ],
  'Animals & Pets': ['dog', 'cat', 'pet', 'animal', 'bird', 'puppy', 'kitten', 'wildlife', 'horse'],
  'Food & Dining': ['food', 'meal', 'restaurant', 'dining', 'drink', 'coffee', 'cooking', 'kitchen', 'dish', 'tea', 'breakfast', 'lunch', 'dinner', 'mug', 'beverage'],
  'Travel & Landmarks': ['travel', 'landmark', 'vacation', 'city', 'tourist', 'monument', 'airport', 'hotel', 'trip', 'building', 'architecture', 'dome', 'tower'],
  'Celebrations & Events': ['party', 'birthday', 'celebration', 'event', 'holiday', 'concert', 'festival', 'cake', 'christmas', 'halloween'],
  'Home & Indoor': ['home', 'indoor', 'room', 'bedroom', 'living', 'house', 'furniture', 'interior', 'apartment', 'office', 'desk', 'counter'],
  'Outdoor Activities': ['sport', 'gym', 'fitness', 'hike', 'bike', 'run', 'workout', 'swim', 'pool', 'basketball', 'soccer', 'football', 'tennis', 'ski', 'camp', 'vaulter', 'athlete', 'pole vault'],
  'Quotes & Text Screenshots': ['screenshot', 'screen', 'text', 'quote', 'meme', 'document', 'sign', 'letter', 'calendar', 'schedule', 'app'],
  'Artwork & Illustrations': ['art', 'drawing', 'painting', 'illustration', 'cartoon', 'sketch', 'design', 'graphic', 'poster', 'retro', 'illustrations'],
};

function photoSearchText(photo) {
  const tags = (photo.ai_tags || []).map((t) => String(t).toLowerCase());
  const desc = tokenize(photo.ai_description || '').join(' ');
  return [...tags, desc].join(' ');
}

function keywordMatch(text, kw) {
  if (text.includes(kw)) return true;
  const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return re.test(text);
}

/** Assign folder using tags/description — zero LLM calls. */
export function assignFolderLocally(photo) {
  const text = photoSearchText(photo);
  if (!text.trim()) return 'Miscellaneous';

  let bestFolder = 'Miscellaneous';
  let bestScore = 0;

  for (const [folder, keywords] of Object.entries(FOLDER_KEYWORD_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      if (keywordMatch(text, kw)) score += kw.length >= 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestFolder = folder;
    }
  }

  return bestFolder;
}

/** Match a folder label to an existing or canonical name without LLM. */
export function normalizeFolderName(name, existingFolderNames = []) {
  const raw = (name || 'Miscellaneous').trim();
  const lower = raw.toLowerCase();

  const existing = existingFolderNames.find((f) => f.toLowerCase() === lower);
  if (existing) return existing;

  const canonical = CANONICAL_FOLDERS.find((f) => f.toLowerCase() === lower);
  if (canonical) return canonical;

  for (const c of CANONICAL_FOLDERS) {
    const cLower = c.toLowerCase();
    if (lower.includes(cLower) || cLower.includes(lower)) return c;
    const cFirst = cLower.split(/\s|&/)[0];
    const rFirst = lower.split(/\s|&/)[0];
    if (cFirst.length >= 4 && rFirst.length >= 4 && (cFirst.startsWith(rFirst) || rFirst.startsWith(cFirst))) {
      return c;
    }
  }

  for (const existingName of existingFolderNames) {
    const eLower = existingName.toLowerCase();
    if (eLower.includes(lower) || lower.includes(eLower)) return existingName;
  }

  return raw || 'Miscellaneous';
}

/** Organize save: keep AI-specific names; only reuse an existing folder on exact name match. */
export function resolveOrganizeFolderName(rawLabel, existingFolderNames = []) {
  const trimmed = (rawLabel || 'Miscellaneous').trim() || 'Miscellaneous';
  const exact = (existingFolderNames || []).find((n) => n.toLowerCase() === trimmed.toLowerCase());
  return exact || trimmed;
}

function uniqueSplitFolderName(baseName, groups, photo, index) {
  const alt = assignFolderLocally(photo);
  if (alt && alt.toLowerCase() !== baseName.toLowerCase() && !groups.has(alt)) return alt;
  let candidate = `${baseName} ${index + 1}`;
  let n = index + 2;
  while (groups.has(candidate)) {
    candidate = `${baseName} ${n}`;
    n += 1;
  }
  return candidate;
}

/** Merge/split label groups so each organize run uses exactly targetCount folder names. */
export function balanceOrganizeLabels(allLabels, photos, { targetCount = TARGET_FOLDERS_PER_RUN } = {}) {
  const photoByNormId = new Map(
    (photos || []).map((p) => [normalizePhotoId(p.id), p]),
  );
  const groups = new Map();

  for (const { id, folder } of allLabels || []) {
    const name = (folder || 'Miscellaneous').trim() || 'Miscellaneous';
    if (!groups.has(name)) groups.set(name, new Set());
    groups.get(name).add(normalizePhotoId(id));
  }

  while (groups.size > targetCount) {
    const sorted = [...groups.entries()].sort((a, b) => a[1].size - b[1].size);
    const [smallName, smallIds] = sorted[0];
    const [, mergeTargetIds] = sorted[1];
    for (const id of smallIds) mergeTargetIds.add(id);
    groups.delete(smallName);
  }

  while (groups.size < targetCount) {
    const sorted = [...groups.entries()].sort((a, b) => b[1].size - a[1].size);
    const [name, ids] = sorted[0];
    if (!ids || ids.size < 2) break;

    const idArr = [...ids];
    const mid = Math.ceil(idArr.length / 2);
    const keep = idArr.slice(0, mid);
    const splitOff = idArr.slice(mid);
    groups.set(name, new Set(keep));

    const samplePhoto = photoByNormId.get(splitOff[0]);
    const newName = samplePhoto
      ? uniqueSplitFolderName(name, groups, samplePhoto, groups.size)
      : `${name} ${groups.size + 1}`;
    groups.set(newName, new Set(splitOff));
  }

  const result = [];
  for (const [folder, ids] of groups) {
    for (const id of ids) {
      if (id) result.push({ id, folder });
    }
  }
  return result;
}

/** Merge folder groups locally — replaces LLM merge phase. */
export function mergeFolderGroupsLocally(groups, existingFolderNames = []) {
  const merged = new Map();

  for (const group of groups) {
    const ids = group.ids || group.photo_ids || [];
    const normalized = normalizeFolderName(group.name, existingFolderNames);
    const key = normalized.toLowerCase();
    if (!merged.has(key)) merged.set(key, { name: normalized, ids: new Set(ids) });
    else ids.forEach((id) => merged.get(key).ids.add(id));
  }

  return Array.from(merged.values()).map((g) => ({
    name: g.name,
    photo_ids: [...g.ids],
  }));
}

function tokenize(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}
