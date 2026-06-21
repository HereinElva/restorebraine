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
  const tags = (photo.ai_tags || []).slice(0, 20);
  return {
    id: photo.id,
    type: photo.file_type || 'image',
    desc: (photo.ai_description || '').substring(0, 320),
    tags,
    top_tags: tags.slice(0, 8),
  };
}

export function buildFolderOptions(existingFolderNames = []) {
  const existingLower = existingFolderNames.map((n) => n.toLowerCase());
  return [
    ...existingFolderNames,
    ...CANONICAL_FOLDERS.filter((c) => !existingLower.includes(c.toLowerCase())),
  ];
}

export const ORGANIZE_LABEL_RULES = `GROUP BY WHAT ITEMS LOOK LIKE — use descriptions and tags:

• Grass, fields, meadows, farms, skies, mountains, beaches, plants, flowers, lakes → "Nature & Landscapes"
• Faces, selfies, groups, family, portraits, people → "People & Portraits"
• Dogs, cats, birds, wildlife, pets → "Animals & Pets"
• Meals, restaurants, drinks, cooking, groceries → "Food & Dining"
• Landmarks, cities, vacations, monuments, airports → "Travel & Landmarks"
• Parties, birthdays, weddings, holidays, concerts → "Celebrations & Events"
• Rooms, furniture, kitchen, bedroom, indoor spaces → "Home & Indoor"
• Sports, hiking, gym, biking, running, swimming → "Outdoor Activities"
• Screenshots, quotes, text, memes, documents → "Quotes & Text Screenshots"
• Art, drawings, paintings, illustrations, cartoons → "Artwork & Illustrations"

Match items with similar VISIBLE subjects into the same folder.`;

export const ORGANIZE_MERGE_RULES = `MERGE BY VISUAL SIMILARITY:
• grass, field, meadow, lawn, pasture, nature, landscape, sky, forest, beach, mountain, flower → "Nature & Landscapes"
• quote, quotes, text, screenshot, meme, document → "Quotes & Text Screenshots"
• food, meal, restaurant, dining, drink, coffee, cooking → "Food & Dining"
• people, portrait, selfie, face, family, friends, baby, child → "People & Portraits"
• dog, cat, pet, animal, bird, wildlife → "Animals & Pets"
• travel, landmark, vacation, city, tourist, hotel → "Travel & Landmarks"
• party, birthday, wedding, celebration, event, holiday → "Celebrations & Events"
• home, indoor, room, kitchen, bedroom, living, house → "Home & Indoor"
• sport, gym, fitness, hike, bike, run, workout → "Outdoor Activities"
• art, drawing, painting, illustration, cartoon → "Artwork & Illustrations"
• else → "Miscellaneous"

When user instructions specify grouping, follow them over default rules.`;

export function buildLabelPrompt({ photoData, folderOptions, customInstructions }) {
  return `You organize a searchable photo/video library by PHYSICAL VISUAL CONTENT.

Assign each item to exactly ONE folder based on what is visible in its description and tags.

AVAILABLE FOLDERS (prefer existing names when content matches):
${folderOptions.map((n) => `- "${n}"`).join('\n')}

${ORGANIZE_LABEL_RULES}

RULES:
- Use EXACTLY folder names from the list above.
- Every item MUST get a label — return exactly ${photoData.length} labels.
- Read ALL tags — they list visible objects, settings, and colors.
- Items with similar visible subjects belong in the same folder.
${customInstructions ? `\nUSER INSTRUCTIONS (highest priority):\n${customInstructions}` : ''}

Items: ${JSON.stringify(photoData)}

Return JSON: { "labels": [{ "id": "...", "folder": "..." }, ...] }`;
}

export function buildMergePrompt({ groups, existingFolderNames, customInstructions }) {
  return `Consolidate folder groups by visual similarity. Merge near-duplicates.

EXISTING FOLDER NAMES:
${existingFolderNames.map((n) => `- "${n}"`).join('\n')}

${ORGANIZE_MERGE_RULES}

Every photo ID must appear exactly once in the output.
${customInstructions ? `\nUSER INSTRUCTIONS (highest priority):\n${customInstructions}` : ''}

Groups: ${JSON.stringify(groups)}

Return JSON: { "folders": [{ "name": "...", "ids": ["..."] }, ...] }`;
}

/** Keyword → canonical folder for local organize (no LLM). */
export const FOLDER_KEYWORD_MAP = {
  'Nature & Landscapes': [
    'grass', 'field', 'meadow', 'lawn', 'pasture', 'nature', 'landscape', 'sky', 'forest',
    'beach', 'mountain', 'flower', 'lake', 'tree', 'outdoor', 'garden', 'plant', 'sunset',
    'sunrise', 'hill', 'river', 'water', 'scenery', 'wildflower',
  ],
  'People & Portraits': [
    'people', 'portrait', 'selfie', 'face', 'family', 'friend', 'baby', 'child', 'person',
    'group', 'smile', 'headshot', 'couple', 'wedding', 'bride', 'groom',
  ],
  'Animals & Pets': ['dog', 'cat', 'pet', 'animal', 'bird', 'puppy', 'kitten', 'wildlife', 'horse'],
  'Food & Dining': ['food', 'meal', 'restaurant', 'dining', 'drink', 'coffee', 'cooking', 'kitchen', 'dish', 'breakfast', 'lunch', 'dinner'],
  'Travel & Landmarks': ['travel', 'landmark', 'vacation', 'city', 'tourist', 'monument', 'airport', 'hotel', 'trip', 'building', 'architecture', 'dome', 'tower'],
  'Celebrations & Events': ['party', 'birthday', 'celebration', 'event', 'holiday', 'concert', 'festival', 'cake', 'christmas', 'halloween'],
  'Home & Indoor': ['home', 'indoor', 'room', 'bedroom', 'living', 'house', 'furniture', 'interior', 'apartment', 'office', 'desk'],
  'Outdoor Activities': ['sport', 'gym', 'fitness', 'hike', 'bike', 'run', 'workout', 'swim', 'pool', 'basketball', 'soccer', 'football', 'tennis', 'ski', 'camp'],
  'Quotes & Text Screenshots': ['screenshot', 'screen', 'text', 'quote', 'meme', 'document', 'sign', 'letter', 'calendar', 'schedule', 'app'],
  'Artwork & Illustrations': ['art', 'drawing', 'painting', 'illustration', 'cartoon', 'sketch', 'design', 'graphic', 'poster', 'retro'],
};

function photoSearchText(photo) {
  const tags = (photo.ai_tags || []).map((t) => String(t).toLowerCase());
  const desc = tokenize(photo.ai_description || '').join(' ');
  return [...tags, desc].join(' ');
}

/** Assign folder using tags/description already on the photo — zero LLM calls. */
export function assignFolderLocally(photo) {
  const text = photoSearchText(photo);
  if (!text.trim()) return 'Miscellaneous';

  let bestFolder = 'Miscellaneous';
  let bestScore = 0;

  for (const [folder, keywords] of Object.entries(FOLDER_KEYWORD_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1;
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
