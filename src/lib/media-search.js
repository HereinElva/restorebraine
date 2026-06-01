const VIDEO_KEYWORDS = new Set(['video', 'videos']);
const IMAGE_KEYWORDS = new Set(['picture', 'pictures', 'image', 'images', 'photo', 'photos']);

const SUFFIXES = ['ing', 'ed', 'es', 's'];

function tokenise(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function termVariants(term) {
  const variants = new Set([term]);
  if (term.length > 4 && term.endsWith('ing')) variants.add(term.slice(0, -3));
  if (term.length > 3 && term.endsWith('es')) variants.add(term.slice(0, -2));
  if (term.length > 3 && term.endsWith('s')) variants.add(term.slice(0, -1));
  if (term.length > 3 && term.endsWith('ed')) variants.add(term.slice(0, -2));
  if (term.length >= 3) variants.add(`${term}s`);
  return [...variants];
}

function textTokens(text) {
  return new Set(tokenise(text));
}

function termMatchesText(term, text) {
  const lower = text.toLowerCase();
  const variants = termVariants(term);

  for (const variant of variants) {
    if (variant.length < 2) continue;
    if (lower.includes(variant)) return true;

    const words = tokenise(lower);
    for (const word of words) {
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
  const tagList = tags;

  for (const tag of tagList) {
    if (termMatchesText(term, tag)) {
      score += tag === term || tag.includes(term) ? 6 : 4;
    }
  }

  if (termMatchesText(term, desc)) score += 3;
  if (termMatchesText(term, filename)) score += 1;

  return score;
}

export function scorePhoto(photo, rawQuery) {
  const queryTokens = tokenise(rawQuery);
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
  const desc = (photo.ai_description || '').toLowerCase();
  if (desc.includes(phrase)) totalScore += 12;

  const allTagsText = tags.join(' ');
  if (termMatchesText(phrase, allTagsText) || contentTokens.every((t) => termMatchesText(t, allTagsText))) {
    totalScore += 8;
  }

  // Require at least half of search terms to match (or all if only 1-2 terms)
  const minMatches = contentTokens.length <= 2 ? contentTokens.length : Math.ceil(contentTokens.length / 2);
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
