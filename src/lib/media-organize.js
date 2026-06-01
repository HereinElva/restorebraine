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
