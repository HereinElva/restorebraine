import { base44 } from '@/api/base44Client';
import { enrichTags, tokenize } from '@/lib/media-tags';

const ANALYSIS_PROMPT = (isVideo, filename) => `You are a visual analyst for Restorebraine — users search their library by typing words that describe what they SEE.

Analyze this ${isVideo ? 'VIDEO. Describe 3-5 key visual scenes/moments in order, plus overall content' : 'PHOTO'} (${filename}).

Look carefully and list EVERY visible element:
• People (count, age, activity, clothing colors)
• Animals and pets
• Objects (vehicles, furniture, food, tools, toys)
• Plants and nature (grass, trees, flowers, water, sky, mountains)
• Setting/environment (indoor/outdoor, room type, landscape type, weather, time of day)
• Dominant colors
• Actions and activities happening

Return JSON:
{
  "ai_description": "2-4 sentences. Lead with the main subject and setting. Include specific searchable nouns: colors, objects, materials, environment. Example: A wide green grass field with wildflowers under a blue sky. Distant oak trees on the horizon on a sunny afternoon.",
  "ai_tags": ["25-35 lowercase keywords and 2-word phrases users would type when searching. Include: main subjects, setting, colors, materials, activities, AND synonyms (grass, field, meadow, lawn; ocean, beach, sea). No dates or filenames."]
}

Be specific and literal — describe what is actually visible, not assumptions.`;

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

  const description = (result.ai_description || filename).trim();
  const rawTags = (Array.isArray(result.ai_tags) ? result.ai_tags : [])
    .map((tag) => String(tag).toLowerCase().trim())
    .filter(Boolean);

  const ai_tags = enrichTags(description, rawTags);

  return { ai_description: description, ai_tags };
}

/** Re-run vision analysis for an existing library item (e.g. before organize). */
export async function reanalyzePhoto(photo) {
  if (!photo?.file_url) {
    throw new Error('Missing file URL for re-analysis');
  }
  return analyzeMedia(
    photo.file_url,
    photo.file_type || 'image',
    photo.original_filename || 'media',
  );
}

export async function reanalyzeWeakPhotos(photos, { onProgress } = {}) {
  const weak = photos.filter((p) => {
    const tagCount = (p.ai_tags || []).length;
    const descLen = (p.ai_description || '').trim().length;
    return tagCount < 10 || descLen < 40;
  });

  if (!weak.length) return photos;

  const updated = new Map(photos.map((p) => [p.id, p]));

  for (let i = 0; i < weak.length; i++) {
    const photo = weak[i];
    onProgress?.(`Sharpening visual tags ${i + 1}/${weak.length}…`);

    try {
      const analysis = await reanalyzePhoto(photo);
      await base44.entities.Photo.update(photo.id, {
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
      });
      updated.set(photo.id, { ...photo, ...analysis });
    } catch (error) {
      console.warn('Re-analysis failed for', photo.id, error);
    }
  }

  return photos.map((p) => updated.get(p.id) || p);
}

export function normalizePhotoTags(tags = []) {
  return enrichTags('', tags);
}
