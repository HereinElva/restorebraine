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

export function getGalleryOrganizeSnapshot() {
  return snapshot;
}
