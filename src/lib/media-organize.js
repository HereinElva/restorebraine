import { isWeakMetadata } from '@/lib/media-tags';

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

/** Target folder count for each organize run — dense batches, not many tiny folders. */
export const ORGANIZE_BATCH_FOLDER_COUNT = 8;

/** Primary folders used when sorting a large loose library for the first time. */
export const ORGANIZE_BATCH_FOLDERS = [
  'People & Portraits',
  'Nature & Landscapes',
  'Travel & Landmarks',
  'Home & Indoor',
  'Food & Dining',
  'Celebrations & Events',
  'Outdoor Activities',
  'Animals & Pets',
];

const BATCH_FOLDER_ALIASES = {
  'quotes & text screenshots': 'Celebrations & Events',
  'artwork & illustrations': 'Nature & Landscapes',
  miscellaneous: 'Home & Indoor',
  'documents & receipts': 'Home & Indoor',
  'digital art & graphics': 'Nature & Landscapes',
};

export function getOrganizeFolderNames(existingFolderNames = [], includeOrganized = false) {
  if (includeOrganized) return [...ORGANIZE_BATCH_FOLDERS];
  // Always sort into the fixed dense canonical set — never expand to every duplicate folder name on the server.
  return [...ORGANIZE_BATCH_FOLDERS];
}

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

export function buildLabelPrompt({ photoData, folderOptions, customInstructions }) {
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
- Compare ALL items in this batch — merge similar subjects into the same folder name.
- Prefer existing folder names when content clearly matches.
- Every item MUST receive a folder — do not skip any id.
`;

  return `You organize a photo/video library by PHYSICAL VISUAL CONTENT.

Assign each item to exactly ONE folder based on its description and tags.

AVAILABLE FOLDERS (use exact spelling; prefer existing names when content matches):
${folderOptions.map((n) => `- "${n}"`).join('\n')}

${ORGANIZE_LABEL_RULES}

RULES:
- Use folder names from the list OR new names required by user instructions.
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

/** Pick the best allowed folder when consolidating into a fixed batch size. */
export function assignFolderToOrganizeBatch(photo, allowedFolderNames = ORGANIZE_BATCH_FOLDERS) {
  const allowed = allowedFolderNames?.length ? allowedFolderNames : ORGANIZE_BATCH_FOLDERS;
  const local = assignFolderLocally(photo);
  const normalized = normalizeFolderName(local, allowed);
  if (allowed.some((name) => name.toLowerCase() === normalized.toLowerCase())) {
    return normalized;
  }

  const alias = BATCH_FOLDER_ALIASES[normalized.toLowerCase()];
  if (alias && allowed.some((name) => name.toLowerCase() === alias.toLowerCase())) {
    return allowed.find((name) => name.toLowerCase() === alias.toLowerCase()) || alias;
  }

  const text = photoSearchText(photo);
  let bestFolder = allowed[0] || ORGANIZE_BATCH_FOLDERS[0];
  let bestScore = 0;

  for (const folder of allowed) {
    const keywords = FOLDER_KEYWORD_MAP[folder] || [];
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

/** Remap labels into dense folders for one organize run. */
export function consolidateOrganizeLabels(
  labels,
  photos,
  allowedFolderNames = ORGANIZE_BATCH_FOLDERS,
  maxFolderCount = ORGANIZE_BATCH_FOLDER_COUNT,
) {
  const allowed = allowedFolderNames?.length ? allowedFolderNames : ORGANIZE_BATCH_FOLDERS;
  const allowedLower = new Set(allowed.map((name) => name.toLowerCase()));
  const photoById = new Map(
    (photos || []).map((photo) => [String(photo.id), photo]),
  );
  const folderCap = Math.min(
    maxFolderCount || ORGANIZE_BATCH_FOLDER_COUNT,
    ORGANIZE_BATCH_FOLDER_COUNT,
  );

  let remapped = (labels || []).map((label) => {
    const photo = photoById.get(String(label.id));
    let folder = normalizeFolderName(label.folder, allowed);
    if (!allowedLower.has(folder.toLowerCase())) {
      folder = assignFolderToOrganizeBatch(photo, allowed);
    }
    return { ...label, folder };
  });

  const counts = new Map();
  for (const label of remapped) {
    counts.set(label.folder, (counts.get(label.folder) || 0) + 1);
  }

  if (counts.size > folderCap) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const keep = new Set(
      ranked.slice(0, folderCap).map(([name]) => name),
    );
    const overflowTarget = ranked[0][0];

    remapped = remapped.map((label) => ({
      ...label,
      folder: keep.has(label.folder) ? label.folder : overflowTarget,
    }));
  }

  return densifyOrganizeLabels(remapped, photos, allowed);
}

/** Merge tiny folder groups into larger related folders for denser batches. */
export function densifyOrganizeLabels(
  labels,
  photos,
  allowedFolderNames = ORGANIZE_BATCH_FOLDERS,
  minPerFolder = 5,
) {
  const allowed = allowedFolderNames?.length ? allowedFolderNames : ORGANIZE_BATCH_FOLDERS;
  const photoById = new Map((photos || []).map((photo) => [String(photo.id), photo]));
  let remapped = (labels || []).map((label) => ({ ...label }));

  for (let pass = 0; pass < 12; pass += 1) {
    const counts = new Map();
    for (const label of remapped) {
      counts.set(label.folder, (counts.get(label.folder) || 0) + 1);
    }
    if (counts.size <= 1) break;

    const ranked = [...counts.entries()].sort((a, b) => a[1] - b[1]);
    const [smallFolder, smallCount] = ranked[0];
    if (smallCount >= minPerFolder) break;

    const candidates = ranked.filter(([name]) => name !== smallFolder);
    const targetFolder = pickDenseFolderTarget(smallFolder, candidates, remapped, photoById, allowed);
    if (!targetFolder || targetFolder === smallFolder) break;

    remapped = remapped.map((label) =>
      label.folder === smallFolder ? { ...label, folder: targetFolder } : label,
    );
  }

  return remapped;
}

function pickDenseFolderTarget(smallFolder, candidates, labels, photoById, allowed) {
  if (!candidates.length) return null;

  const smallPhotos = labels
    .filter((label) => label.folder === smallFolder)
    .map((label) => photoById.get(String(label.id)))
    .filter(Boolean);

  let bestFolder = candidates[candidates.length - 1][0];
  let bestScore = -1;

  for (const [candidateName] of candidates) {
    const score = candidateName === smallFolder
      ? 0
      : smallPhotos.reduce((sum, photo) => {
          const local = assignFolderToOrganizeBatch(photo, allowed);
          return sum + (local.toLowerCase() === candidateName.toLowerCase() ? 3 : 0);
        }, 0) + (candidates.find(([name]) => name === candidateName)?.[1] || 0);

    if (score > bestScore) {
      bestScore = score;
      bestFolder = candidateName;
    }
  }

  return bestFolder;
}

/** Match a folder label to an existing or canonical name without LLM. */
export function normalizeFolderName(name, existingFolderNames = []) {
  const raw = (name || 'Miscellaneous').trim();
  let lower = raw.toLowerCase();

  const alias = BATCH_FOLDER_ALIASES[lower];
  if (alias) {
    lower = alias.toLowerCase();
    const aliasedExisting = existingFolderNames.find((f) => f.toLowerCase() === lower);
    if (aliasedExisting) return aliasedExisting;
    return alias;
  }

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
