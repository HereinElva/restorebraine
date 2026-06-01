/** Synonym groups — any term in a group matches searches for siblings. */
export const SYNONYM_GROUPS = [
  ['grass', 'field', 'meadow', 'lawn', 'pasture', 'greenery', 'prairie', 'turf'],
  ['beach', 'ocean', 'sea', 'sand', 'shore', 'coast', 'waves', 'waterfront'],
  ['forest', 'woods', 'trees', 'woodland', 'grove'],
  ['mountain', 'mountains', 'hills', 'peak', 'summit', 'alps'],
  ['dog', 'puppy', 'canine', 'dogs'],
  ['cat', 'kitten', 'feline', 'cats'],
  ['car', 'vehicle', 'automobile', 'truck', 'suv'],
  ['food', 'meal', 'dish', 'cuisine', 'dining', 'restaurant'],
  ['baby', 'infant', 'toddler', 'child', 'kid'],
  ['sunset', 'sunrise', 'dusk', 'dawn', 'golden hour'],
  ['snow', 'winter', 'snowy', 'ice', 'frost'],
  ['flower', 'flowers', 'bloom', 'blossom', 'garden'],
  ['city', 'urban', 'downtown', 'street', 'skyline'],
  ['pool', 'swimming', 'swim'],
  ['wedding', 'bride', 'groom', 'marriage'],
  ['birthday', 'cake', 'party', 'celebration'],
  ['selfie', 'portrait', 'face', 'headshot'],
  ['screenshot', 'screen', 'text', 'quote', 'meme'],
];

const synonymIndex = new Map();
for (const group of SYNONYM_GROUPS) {
  const normalized = group.map((w) => w.toLowerCase());
  for (const word of normalized) {
    synonymIndex.set(word, normalized);
  }
}

export function expandTermVariants(term) {
  const lower = term.toLowerCase().trim();
  const variants = new Set([lower]);

  const group = synonymIndex.get(lower);
  if (group) group.forEach((w) => variants.add(w));

  if (lower.length > 4 && lower.endsWith('ing')) variants.add(lower.slice(0, -3));
  if (lower.length > 3 && lower.endsWith('es')) variants.add(lower.slice(0, -2));
  if (lower.length > 3 && lower.endsWith('s')) variants.add(lower.slice(0, -1));
  if (lower.length > 3 && lower.endsWith('ed')) variants.add(lower.slice(0, -2));
  if (lower.length >= 3) variants.add(`${lower}s`);

  return [...variants];
}

export function enrichTags(description, tags = []) {
  const merged = new Set(
    tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean),
  );

  for (const word of tokenize(description)) {
    if (word.length < 3) continue;
    merged.add(word);
    expandTermVariants(word).forEach((v) => merged.add(v));
  }

  for (const tag of [...merged]) {
    expandTermVariants(tag).forEach((v) => merged.add(v));
  }

  return [...merged].slice(0, 35);
}

export function expandQueryTerms(rawQuery) {
  const terms = tokenize(rawQuery);
  const expanded = new Set();

  for (const term of terms) {
    expandTermVariants(term).forEach((v) => expanded.add(v));
  }

  return { terms, expanded: [...expanded] };
}

export function tokenize(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

export function isWeakMetadata(photo) {
  const tagCount = (photo.ai_tags || []).length;
  const descLen = (photo.ai_description || '').trim().length;
  return tagCount < 10 || descLen < 40;
}
