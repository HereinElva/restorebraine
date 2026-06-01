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

/** Rich metadata for AI folder labeling — more tags = better physical grouping. */
export function photoDataForOrganize(photo) {
  return {
    id: photo.id,
    type: photo.file_type || 'image',
    desc: (photo.ai_description || '').substring(0, 280),
    tags: (photo.ai_tags || []).slice(0, 15).join(', '),
  };
}

export function buildFolderOptions(existingFolderNames = []) {
  const existingLower = existingFolderNames.map((n) => n.toLowerCase());
  return [
    ...existingFolderNames,
    ...CANONICAL_FOLDERS.filter((c) => !existingLower.includes(c.toLowerCase())),
  ];
}

export const ORGANIZE_LABEL_RULES = `GROUP BY VISIBLE PHYSICAL CONTENT — what the items look like:
- Green fields, mountains, beaches, skies, plants, flowers → "Nature & Landscapes"
- Faces, selfies, groups of people, portraits → "People & Portraits"
- Dogs, cats, birds, wildlife → "Animals & Pets"
- Meals, restaurants, drinks, cooking → "Food & Dining"
- Landmarks, cities, vacations, monuments → "Travel & Landmarks"
- Parties, birthdays, weddings, holidays → "Celebrations & Events"
- Rooms, furniture, indoor spaces → "Home & Indoor"
- Sports, hiking, biking, outdoor recreation → "Outdoor Activities"
- Screenshots of text, quotes, memes → "Quotes & Text Screenshots"
- Drawings, paintings, digital art → "Artwork & Illustrations"
- Group items with similar physical subjects together (e.g. all grass/field photos in Nature & Landscapes)`;
