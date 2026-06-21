import { persistentStorage } from '@/lib/persistentStorage';
import { normalizePhotoId } from '@/lib/gallery-organize-snapshot';

const CACHE_KEY_PREFIX = 'restorebraine_folder_membership:';

function cacheKey(email) {
  return `${CACHE_KEY_PREFIX}${email || 'unknown'}`;
}

function mergeIds(existingIds = [], newIds = []) {
  const merged = [...(existingIds || []), ...(newIds || [])];
  const seen = new Set();
  const result = [];
  for (const id of merged) {
    const norm = normalizePhotoId(id);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    result.push(id);
  }
  return result;
}

/** photoNormId -> folderId */
export async function loadFolderMembershipCache(email) {
  if (!email) return {};
  try {
    const raw = await persistentStorage.get(cacheKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveFolderMembershipCache(email, photoFolderMap) {
  if (!email) return;
  await persistentStorage.set(cacheKey(email), JSON.stringify(photoFolderMap || {}));
}

export async function clearFolderMembershipCache(email) {
  if (!email) return;
  await persistentStorage.remove(cacheKey(email));
}

export async function recordPhotoFolderMembership(email, photoId, folderId) {
  if (!email || photoId == null || !folderId) return;
  const map = await loadFolderMembershipCache(email);
  map[normalizePhotoId(photoId)] = folderId;
  await saveFolderMembershipCache(email, map);
}

export async function recordBatchFolderMembership(email, entries) {
  if (!email || !entries?.length) return;
  const map = await loadFolderMembershipCache(email);
  for (const { photoId, folderId } of entries) {
    if (photoId == null || !folderId) continue;
    map[normalizePhotoId(photoId)] = folderId;
  }
  await saveFolderMembershipCache(email, map);
}

/** Apply cached photo→folder map onto folder list (survives app reload). */
export function applyFolderMembershipCache(folders, photos, membershipMap) {
  if (!membershipMap || !Object.keys(membershipMap).length) return folders || [];

  const folderById = new Map((folders || []).map((f) => [f.id, { ...f }]));
  const photoByNorm = new Map((photos || []).map((p) => [normalizePhotoId(p.id), p.id]));

  for (const [photoNorm, folderId] of Object.entries(membershipMap)) {
    const folder = folderById.get(folderId);
    const photoId = photoByNorm.get(normalizePhotoId(photoNorm));
    if (!folder || photoId == null) continue;
    folder.photo_ids = mergeIds(folder.photo_ids, [photoId]);
    folderById.set(folderId, folder);
  }

  return [...folderById.values()];
}

/** Build cache map from current folder photo_ids. */
export function buildMembershipMapFromFolders(folders) {
  const map = {};
  for (const folder of folders || []) {
    for (const photoId of folder.photo_ids || []) {
      const norm = normalizePhotoId(photoId);
      if (norm) map[norm] = folder.id;
    }
  }
  return map;
}
