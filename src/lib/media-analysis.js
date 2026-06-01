import { base44 } from '@/api/base44Client';

const ANALYSIS_PROMPT = (isVideo, filename) => `You are analyzing media for Restorebraine, a searchable photo and video library.

The user finds items by typing words that describe what they SEE — physical appearance, not dates or filenames.

Analyze this ${isVideo ? 'video (describe the main visible scenes across the clip)' : 'photo'} (${filename}).

Describe concrete visual content:
- Objects, people, animals, food, vehicles, buildings, plants
- Environments and settings (grass field, beach, kitchen, office, forest, city street, bedroom)
- Colors, lighting, weather, time of day
- Visible activities and actions
- Materials and textures (wood, metal, water, snow, fabric)

Return JSON with:
1. "ai_description": 2-3 sentences packed with searchable nouns/adjectives someone would type when looking for this item. Example: "A wide green grass field with tall wild grass under a bright blue sky. Distant trees line the horizon on a sunny day."

2. "ai_tags": 15-25 lowercase searchable keywords — single words AND 2-word phrases users might search. Include synonyms and related terms (grass, field, meadow, lawn, pasture; ocean, beach, sea, sand). Tags must describe visible physical content only.`;

export async function analyzeMedia(fileUrl, fileType, filename) {
  const isVideo = fileType === 'video';

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: ANALYSIS_PROMPT(isVideo, filename),
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        ai_description: { type: 'string' },
        ai_tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['ai_description', 'ai_tags'],
    },
  });

  const tags = (Array.isArray(result.ai_tags) ? result.ai_tags : [])
    .map((tag) => String(tag).toLowerCase().trim())
    .filter(Boolean);

  return {
    ai_description: result.ai_description || filename,
    ai_tags: [...new Set(tags)],
  };
}

/** Normalize tags/description on existing records (e.g. after manual edits). */
export function normalizePhotoTags(tags = []) {
  return [...new Set(
    tags
      .map((tag) => String(tag).toLowerCase().trim())
      .filter(Boolean),
  )];
}
