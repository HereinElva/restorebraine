import { base44 } from '@/api/base44Client';
import { enrichTags, isWeakMetadata } from '@/lib/media-tags';
import { invokeLLMWithRetry } from '@/lib/invoke-llm-retry';
import { runConcurrent } from '@/lib/concurrency';

const ANALYSIS_PROMPT = (isVideo, filename) => `You are a precise visual analyst for Restorebraine. Users search and organize their library by what they SEE.

Analyze this ${isVideo ? 'VIDEO — describe 3-5 key scenes in order, then summarize overall' : 'PHOTO'} (${filename}).

Inspect the actual pixels carefully. List every visible detail:
• Main subject(s) and what they are doing
• People: count, approximate age, clothing colors, expressions, activities
• Animals/pets: species, breed if visible, activity
• Objects: food, vehicles, furniture, sports equipment, screens, documents
• Environment: indoor/outdoor, room type, landscape (grass, beach, forest, city, etc.)
• Weather, lighting, time of day, dominant colors
• For videos: note motion/action across scenes

Return JSON:
{
  "ai_description": "3-5 specific sentences. Sentence 1: main subject + setting. Then list visible objects, colors, environment, and activity using concrete nouns users would search (e.g. iced tea, glass mug, kitchen counter, golden retriever, green grass field, birthday cake). No filename. No guessing beyond what is visible.",
  "ai_tags": ["30-40 lowercase search keywords and 2-word phrases. Include: subjects, objects, materials, colors, setting, activities, AND synonyms (grass/field/meadow, ocean/beach/sea, dog/puppy/pet). Prioritize what is literally visible."]
}

Be literal and specific — only describe what is actually visible.`;

export async function analyzeMedia(fileUrl, fileType, filename, { timeoutMs = 55000 } = {}) {
  const isVideo = fileType === 'video';

  const result = await invokeLLMWithRetry(
    {
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
    },
    { maxRetries: 1, baseDelayMs: 3000, timeoutMs },
  );

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

export async function reanalyzeWeakPhotos(photos, {
  onProgress,
  concurrency = 1,
  delayMs = 1500,
  forceAll = false,
  timeoutMs = 55000,
} = {}) {
  const weak = forceAll ? photos : photos.filter(isWeakMetadata);

  if (!weak.length) return photos;

  const updated = new Map(photos.map((p) => [p.id, p]));
  let completed = 0;

  const tasks = weak.map((photo) => async () => {
    if (completed > 0 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const analysis = await analyzeMedia(
        photo.file_url,
        photo.file_type || 'image',
        photo.original_filename || 'media',
        { timeoutMs },
      );
      await base44.entities.Photo.update(photo.id, {
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
      });
      updated.set(photo.id, { ...photo, ...analysis });
    } catch (error) {
      console.warn('Re-analysis failed for', photo.id, error);
    } finally {
      completed += 1;
      onProgress?.(`Re-reading ${completed}/${weak.length}…`);
    }
  });

  await runConcurrent(tasks, concurrency);

  return photos.map((p) => updated.get(p.id) || p);
}

export function normalizePhotoTags(tags = []) {
  return enrichTags('', tags);
}
