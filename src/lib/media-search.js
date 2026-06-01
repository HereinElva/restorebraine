import { expandQueryTerms, tokenize } from '@/lib/media-tags';

const VIDEO_KEYWORDS = new Set(['video', 'videos']);
const IMAGE_KEYWORDS = new Set(['picture', 'pictures', 'image', 'images', 'photo', 'photos']);

function termMatchesText(term, text) {
  const lower = text.toLowerCase();
  const variants = expandQueryTerms(term).expanded;

  for (const variant of variants) {
    if (variant.length < 2) continue;
    if (lower.includes(variant)) return true;

    for (const word of tokenize(lower)) {
      if (word === variant) return true;
      if (variant.length >= 3 && word.startsWith(variant)) return true;
      if (word.length >= 3 && variant.startsWith(word)) return true;
    }
  }

  return false;
}

function scoreTerm(term, photo, tags) {
  let score = 0;
  const desc = photo.ai_description || '';
  const filename = photo.original_filename || '';
  const variants = expandQueryTerms(term).expanded;

  for (const variant of variants) {
    for (const tag of tags) {
      if (tag === variant) score += 8;
      else if (tag.includes(variant) || variant.includes(tag)) score += 5;
    }
    if (termMatchesText(variant, desc)) score += 3;
    if (termMatchesText(variant, filename)) score += 1;
  }

  return score;
}

export function scorePhoto(photo, rawQuery) {
  const queryTokens = tokenize(rawQuery);
  if (queryTokens.length === 0) return 1;

  const typeTokens = queryTokens.filter((t) => VIDEO_KEYWORDS.has(t) || IMAGE_KEYWORDS.has(t));
  const contentTokens = queryTokens.filter((t) => !VIDEO_KEYWORDS.has(t) && !IMAGE_KEYWORDS.has(t));

  if (typeTokens.some((t) => VIDEO_KEYWORDS.has(t)) && photo.file_type !== 'video') return 0;
  if (typeTokens.some((t) => IMAGE_KEYWORDS.has(t)) && photo.file_type !== 'image') return 0;
  if (contentTokens.length === 0) return 1;

  const tags = (photo.ai_tags || []).map((t) => String(t).toLowerCase());
  let totalScore = 0;
  let matchedTerms = 0;

  for (const term of contentTokens) {
    const termScore = scoreTerm(term, photo, tags);
    if (termScore > 0) {
      matchedTerms += 1;
      totalScore += termScore;
    }
  }

  if (matchedTerms === 0) return 0;

  const phrase = contentTokens.join(' ');
  if (termMatchesText(phrase, photo.ai_description || '')) totalScore += 15;

  const allTagsText = tags.join(' ');
  if (contentTokens.every((t) => termMatchesText(t, allTagsText))) totalScore += 10;

  const minMatches = contentTokens.length <= 2
    ? contentTokens.length
    : Math.ceil(contentTokens.length * 0.5);

  if (matchedTerms < minMatches) return 0;

  return totalScore;
}

export function filterAndRankPhotos(photos, rawQuery) {
  if (!rawQuery?.trim()) return photos;

  return photos
    .map((photo) => ({ photo, score: scorePhoto(photo, rawQuery) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ photo }) => photo);
}
