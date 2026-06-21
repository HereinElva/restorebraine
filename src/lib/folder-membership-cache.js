import { persistentStorage } from '@/lib/persistentStorage';
import { normalizePhotoId } from '@/lib/gallery-organize-snapshot';

const CACHE_KEY_PREFIX = 'restorebraine_folder_membership:';
const SNAPSHOT_KEY_PREFIX = 'restorebraine_folder_snapshot:';
const PERSIST_TIMEOUT_MS = 8000;

/** Serialize Preferences writes — concurrent get/set pairs can hang on iOS. */
let persistQueue = Promise.resolve();

function enqueuePersist(task) {
  const run = persistQueue.then(task, task);
  persistQueue = run.catch(() => {});
  return run;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(email) {
  return `${CACHE_KEY_PREFIX}${email || 'unknown'}`;
}

function snapshotKey(email) {
  return `${SNAPSHOT_KEY_PREFIX}${email || 'unknown'}`;
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
    if (!raw) return loadFolderMembershipCacheSync(email);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return loadFolderMembershipCacheSync(email);
  }
}

export function loadFolderMembershipCacheSync(email) {
  if (!email) return {};
  try {
    const raw = persistentStorage.getSync(cacheKey(email));
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

/** Last known folder list — used when Folder.list is slow or returns empty. */
export async function loadFolderSnapshotCache(email) {
  const fromSync = loadFolderSnapshotCacheSync(email);
  if (!email) return fromSync;
  try {
    const raw = await persistentStorage.get(snapshotKey(email));
    if (!raw) return fromSync;
    const parsed = JSON.parse(raw);
    const fromAsync = Array.isArray(parsed) ? parsed : [];
    if (!fromSync.length) return fromAsync;
    if (!fromAsync.length) return fromSync;
    return mergeSnapshotRecords(fromSync, fromAsync);
  } catch {
    return fromSync;
  }
}

function mergeSnapshotRecords(a = [], b = []) {
  const byId = new Map();
  for (const folder of [...a, ...b]) {
    if (!folder?.id) continue;
    const prev = byId.get(folder.id);
    if (prev) {
      byId.set(folder.id, {
        ...prev,
        ...folder,
        photo_ids: mergeIds(prev.photo_ids, folder.photo_ids),
      });
    } else {
      byId.set(folder.id, { ...folder });
    }
  }
  return [...byId.values()];
}

function slimFolderSnapshot(folders) {
  return (folders || []).map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description || '',
    photo_ids: f.photo_ids || [],
    cover_photo_url: f.cover_photo_url || '',
    created_by: f.created_by,
  }));
}

async function writeFolderSnapshot(email, folders) {
  const existing = loadFolderSnapshotCacheSync(email);
  const merged = mergeSnapshotRecords(existing, folders);
  await persistentStorage.set(snapshotKey(email), JSON.stringify(slimFolderSnapshot(merged)));
}

export async function saveFolderSnapshotCache(email, folders) {
  if (!email || !folders?.length) return;
  await writeFolderSnapshot(email, folders);
}

/** Fast snapshot write during organize — sync merge only, no blocking Preferences read. */
export async function saveFolderSnapshotCacheFast(email, folders) {
  if (!email || !folders?.length) return;
  await writeFolderSnapshot(email, folders);
}

/** Instant read from localStorage mirror — for showing cached folders before API responds. */
export function loadFolderSnapshotCacheSync(email) {
  if (!email) return [];
  try {
    const raw = persistentStorage.getSync(snapshotKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearFolderSnapshotCache(email) {
  if (!email) return;
  await persistentStorage.remove(snapshotKey(email));
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

async function persistGalleryFoldersCore(email, folders) {
  await writeFolderSnapshot(email, folders);
  const existingMap = loadFolderMembershipCacheSync(email);
  const fromFolders = buildMembershipMapFromFolders(folders);
  await saveFolderMembershipCache(email, { ...existingMap, ...fromFolders });
}

/** Await snapshot + membership so folders survive app close/reload. */
export async function persistGalleryFolders(email, folders, { timeoutMs = PERSIST_TIMEOUT_MS } = {}) {
  if (!email || !folders?.length) return;
  const work = enqueuePersist(() => persistGalleryFoldersCore(email, folders));
  await Promise.race([work, sleep(timeoutMs)]);
}

/** Fire-and-forget during organize saves — queued but never blocks callers. */
export function persistGalleryFoldersFast(email, folders) {
  if (!email || !folders?.length) return;
  void enqueuePersist(() => persistGalleryFoldersCore(email, folders));
}
