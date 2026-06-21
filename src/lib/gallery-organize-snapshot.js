/** Normalize photo/folder IDs for consistent Set lookups (string vs number). */
export function normalizePhotoId(id) {
  if (id == null) return '';
  return String(id).trim();
}

/** In-memory snapshot from Gallery — matches what Recents shows on screen. */
let snapshot = { folders: [], photos: [] };

export function setGalleryOrganizeSnapshot({ folders = [], photos = [] } = {}) {
  snapshot = { folders, photos };
}

export function getOrganizedPhotoIds(folders = snapshot.folders) {
  return new Set(
    (folders || []).flatMap((f) => (f.photo_ids || []).map(normalizePhotoId)).filter(Boolean)
  );
}

/** Loose / Recents photos — same logic as MobileGallery unorganizedPhotos. */
export function getUnorganizedPhotos(photos = snapshot.photos, folders = snapshot.folders) {
  const organized = getOrganizedPhotoIds(folders);
  return (photos || []).filter((p) => p?.id != null && !organized.has(normalizePhotoId(p.id)));
}

/** Map IDs to the same type/value stored on Photo entities (fixes Recents not clearing). */
export function toStoredPhotoIds(ids, photos = snapshot.photos) {
  const photoByNorm = new Map(
    (photos || []).map((p) => [normalizePhotoId(p.id), p.id]),
  );
  const stored = [];
  for (const id of ids || []) {
    const norm = normalizePhotoId(id);
    if (!norm) continue;
    const original = photoByNorm.get(norm);
    if (original != null && !stored.some((s) => normalizePhotoId(s) === norm)) {
      stored.push(original);
    }
  }
  return stored;
}

/** Merge folder photo_ids preserving canonical Photo.id values (deduped by normalized id). */
export function mergeStoredPhotoIds(existingIds = [], newIds = [], photos = snapshot.photos) {
  const byNorm = new Map();
  for (const id of [...existingIds, ...newIds]) {
    const norm = normalizePhotoId(id);
    if (!norm) continue;
    const stored = toStoredPhotoIds([id], photos)[0];
    if (stored != null) byNorm.set(norm, stored);
  }
  return [...byNorm.values()];
}

/** Normalized Set of every photo id assigned to a folder (for Recents membership). */
export function getOrganizedPhotoIdSet(folders = snapshot.folders) {
  return getOrganizedPhotoIds(folders);
}

export function countOrganizedPhotos(photos, folders) {
  const organized = getOrganizedPhotoIds(folders);
  return (photos || []).filter((p) => organized.has(normalizePhotoId(p.id))).length;
}

export function getGalleryOrganizeSnapshot() {
  return snapshot;
}

/** Folder list with photo_ids aligned to Photo.id — same shape Gallery passes to MobileGallery. */
export function foldersForGalleryView(folders, photos) {
  return (folders || []).map((folder) => ({
    ...folder,
    photo_ids: toStoredPhotoIds(folder.photo_ids, photos),
  }));
}
