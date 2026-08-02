import { base44 } from '@/api/base44Client';
import { normalizeFolderName, ORGANIZE_BATCH_FOLDER_COUNT, ORGANIZE_BATCH_FOLDERS } from '@/lib/media-organize';
import {
  getUnorganizedPhotos,
  normalizePhotoId,
  sanitizeFolderPhotoIds,
  toStoredPhotoIds,
} from '@/lib/gallery-organize-snapshot';
import {
  applyFolderMembershipCache,
  clearFolderMembershipCache,
  loadFolderMembershipCache,
  loadFolderSnapshotCacheSync,
  loadFullFolderSnapshotAsync,
  persistGalleryFolders,
  persistGalleryFoldersSync,
  recordBatchFolderMembership,
  recordPhotoFolderMembership,
  saveFolderMembershipCache,
  saveFolderSnapshotCache,
} from '@/lib/folder-membership-cache';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickOverflowFolder(folders, nameContext = []) {
  const ranked = [...(folders || [])].sort(
    (a, b) => (b.photo_ids?.length || 0) - (a.photo_ids?.length || 0),
  );
  return ranked[0] || null;
}

function resolveOrganizeFolderName(labelName, nameContext) {
  return normalizeFolderName(labelName || 'Miscellaneous', nameContext);
}

/** Unwrap Base44 records that nest fields under `.data`. */
export function normalizeFolderRecord(folder) {
  if (!folder) return folder;
  const inner =
    folder.data && typeof folder.data === 'object' && !Array.isArray(folder.data)
      ? folder.data
      : {};
  return {
    ...inner,
    ...folder,
    id: folder.id || inner.id,
    name: folder.name || inner.name,
    description: folder.description ?? inner.description ?? '',
    photo_ids: folder.photo_ids || inner.photo_ids || [],
    cover_photo_url: folder.cover_photo_url || inner.cover_photo_url || '',
    created_by: folder.created_by ?? inner.created_by,
  };
}

/** Same merge as MobilePhotoModal — append canonical photo.id values only. */
export function mergePhotoIdsLikeManualMove(existingIds = [], newIds = []) {
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

export function findFolderByDisplayName(folders, folderName, existingFolderNames = []) {
  const targetKey = normalizeFolderName(folderName, existingFolderNames).toLowerCase();
  const matches = (folders || []).filter(
    (f) => normalizeFolderName(f.name, existingFolderNames).toLowerCase() === targetKey,
  );
  if (matches.length === 0) return undefined;
  return matches.sort(
    (a, b) => (b.photo_ids?.length || 0) - (a.photo_ids?.length || 0),
  )[0];
}

/** Keep one folder per normalized name — prefer the one with the most photos. */
export function dedupeFoldersByNormalizedName(folders, existingFolderNames = []) {
  const byKey = new Map();
  for (const folder of folders || []) {
    const key = normalizeFolderName(folder.name, existingFolderNames).toLowerCase();
    const existing = byKey.get(key);
    if (!existing || (folder.photo_ids?.length || 0) > (existing.photo_ids?.length || 0)) {
      byKey.set(key, folder);
    }
  }
  return [...byKey.values()];
}

function photoIdsPersisted(persistedIds, expectedIds) {
  const persistedNorm = new Set((persistedIds || []).map(normalizePhotoId));
  return (expectedIds || []).every((id) => persistedNorm.has(normalizePhotoId(id)));
}

const FOLDER_DELETE_TIMEOUT_MS = 8000;
const FOLDER_API_TIMEOUT_MS = 25000;
const ORGANIZE_SAVE_TIMEOUT_MS = 35000;
const FOLDER_SAVE_CHUNK_SIZE = 50;

function withFolderApiTimeout(promise, label, timeoutMs = FOLDER_API_TIMEOUT_MS) {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }),
  ]);
}

export async function listAllFoldersSafe({ timeoutMs = 12000 } = {}) {
  try {
    const result = await withFolderApiTimeout(
      base44.entities.Folder.list('-created_date', 200),
      'Folder.list',
      timeoutMs,
    );
    return (result || []).map(normalizeFolderRecord);
  } catch (error) {
    console.warn('Folder.list failed:', error);
    return [];
  }
}

export async function listAllFolders() {
  return listAllFoldersSafe();
}

async function getFolderOnServer(folderId) {
  const folder = await withFolderApiTimeout(
    base44.entities.Folder.get(folderId),
    `Folder.get ${folderId}`,
  );
  return normalizeFolderRecord(folder);
}

async function createFolderOnServer(payload, timeoutMs = FOLDER_API_TIMEOUT_MS) {
  const folder = await withFolderApiTimeout(
    base44.entities.Folder.create(payload),
    'Folder.create',
    timeoutMs,
  );
  return normalizeFolderRecord(folder);
}

async function updateFolderPhotoIdsWithTimeout(
  folderId,
  photoIds,
  extra = {},
  timeoutMs = FOLDER_API_TIMEOUT_MS,
) {
  const updated = await withFolderApiTimeout(
    base44.entities.Folder.update(folderId, { photo_ids: photoIds, ...extra }),
    `Folder.update ${folderId}`,
    timeoutMs,
  );
  return normalizeFolderRecord(updated);
}

/** Delete folders in parallel; each call times out so organize never hangs indefinitely. */
export async function deleteFoldersWithTimeout(folderIds, { timeoutMs = FOLDER_DELETE_TIMEOUT_MS } = {}) {
  const ids = [...new Set((folderIds || []).filter(Boolean))];
  if (!ids.length) return { deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Promise.race([
          base44.entities.Folder.delete(id),
          sleep(timeoutMs).then(() => {
            throw new Error(`Folder delete timed out: ${id}`);
          }),
        ]);
        deleted += 1;
      } catch (error) {
        console.warn('Folder delete failed:', id, error);
        failed += 1;
      }
    }),
  );
  return { deleted, failed };
}

/** Remove folders with no valid gallery photos — optionally delete them on the server. */
export async function pruneEmptyGalleryFolders(
  folders,
  photos,
  { deleteOnServer = true } = {},
) {
  const emptyIds = [];
  const nonEmpty = [];

  for (const folder of folders || []) {
    const photoIds = sanitizeFolderPhotoIds(folder.photo_ids, photos);
    if (photoIds.length === 0) {
      if (folder?.id) emptyIds.push(folder.id);
      continue;
    }
    nonEmpty.push({ ...folder, photo_ids: photoIds });
  }

  if (deleteOnServer && emptyIds.length) {
    await deleteFoldersWithTimeout(emptyIds);
  }

  return nonEmpty;
}

export function countFoldersWithPhotos(folders, photos) {
  return (folders || []).filter(
    (folder) => sanitizeFolderPhotoIds(folder.photo_ids, photos).length > 0,
  ).length;
}

/** Merge server folders that share the same canonical name into one folder each. */
export async function mergeDuplicateFoldersOnServer(
  folders,
  { onProgress, canonicalNames = ORGANIZE_BATCH_FOLDERS } = {},
) {
  const groups = new Map();
  for (const folder of folders || []) {
    const canonical = normalizeFolderName(folder.name, canonicalNames);
    const key = canonical.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: canonical, folders: [] });
    groups.get(key).folders.push(folder);
  }

  let mergedFolders = [...(folders || [])];
  for (const group of groups.values()) {
    const dupes = group.folders;
    if (dupes.length <= 1) {
      const only = dupes[0];
      if (only && only.name !== group.name) {
        try {
          const renamed = await updateFolderPhotoIdsWithTimeout(
            only.id,
            only.photo_ids || [],
            { name: group.name },
            ORGANIZE_SAVE_TIMEOUT_MS,
          );
          mergedFolders = mergedFolders.map((folder) =>
            folder.id === only.id ? { ...folder, ...renamed, name: group.name } : folder,
          );
        } catch (error) {
          console.warn('Folder rename failed:', group.name, error);
        }
      }
      continue;
    }

    dupes.sort((a, b) => (b.photo_ids?.length || 0) - (a.photo_ids?.length || 0));
    const keeper = { ...dupes[0], name: group.name };
    const duplicateIds = [];

    for (const dupe of dupes.slice(1)) {
      keeper.photo_ids = mergePhotoIdsLikeManualMove(keeper.photo_ids, dupe.photo_ids);
      duplicateIds.push(dupe.id);
    }

    onProgress?.(`Merging ${dupes.length} "${group.name}" folders…`);

    try {
      const saved = await updateFolderPhotoIdsWithTimeout(
        keeper.id,
        keeper.photo_ids,
        {
          name: group.name,
          cover_photo_url: keeper.cover_photo_url || dupes.find((f) => f.cover_photo_url)?.cover_photo_url || '',
        },
        ORGANIZE_SAVE_TIMEOUT_MS,
      );
      await deleteFoldersWithTimeout(duplicateIds);
      mergedFolders = mergedFolders
        .filter((folder) => !duplicateIds.includes(folder.id))
        .map((folder) => (folder.id === keeper.id ? { ...folder, ...saved, name: group.name } : folder));
    } catch (error) {
      console.warn('mergeDuplicateFoldersOnServer failed:', group.name, error);
    }
  }

  return dedupeFoldersByNormalizedName(mergedFolders, canonicalNames);
}

/** Photos assigned to more than one folder (by normalized photo id). */
export function findCrossFolderPhotoDuplicates(folders) {
  const photoToFolderIds = new Map();
  for (const folder of folders || []) {
    if (!folder?.id) continue;
    for (const photoId of folder.photo_ids || []) {
      const norm = normalizePhotoId(photoId);
      if (!norm) continue;
      if (!photoToFolderIds.has(norm)) photoToFolderIds.set(norm, new Set());
      photoToFolderIds.get(norm).add(folder.id);
    }
  }

  const duplicates = [];
  for (const [photoNorm, folderIds] of photoToFolderIds) {
    if (folderIds.size <= 1) continue;
    duplicates.push({ photoNorm, folderIds: [...folderIds] });
  }
  return duplicates;
}

function pickKeeperFolderForPhoto(locations, membershipMap = {}, canonicalNames = ORGANIZE_BATCH_FOLDERS) {
  const photoNorm = locations[0]?.photoNorm;
  const cachedId = photoNorm ? membershipMap[photoNorm] : null;
  if (cachedId && locations.some((entry) => entry.folderId === cachedId)) {
    return cachedId;
  }

  const ranked = [...locations].sort((a, b) => {
    const aCanon = normalizeFolderName(a.folder.name, canonicalNames).toLowerCase();
    const bCanon = normalizeFolderName(b.folder.name, canonicalNames).toLowerCase();
    const batchLower = new Set(canonicalNames.map((name) => name.toLowerCase()));
    const aBatch = batchLower.has(aCanon) ? 1 : 0;
    const bBatch = batchLower.has(bCanon) ? 1 : 0;
    if (aBatch !== bBatch) return bBatch - aBatch;
    return (b.folder.photo_ids?.length || 0) - (a.folder.photo_ids?.length || 0);
  });

  return ranked[0]?.folderId || locations[0]?.folderId;
}

/** Ensure each photo appears in at most one folder — updates server copies outside the keeper folder. */
export async function enforceUniquePhotoMembershipOnServer(
  folders,
  { onProgress, canonicalNames = ORGANIZE_BATCH_FOLDERS, membershipMap = {} } = {},
) {
  let allFolders = mergeApiFoldersWithLocal(
    await listAllFoldersSafe({ timeoutMs: 12000 }),
    folders || [],
  );
  allFolders = (allFolders || []).map(normalizeFolderRecord);

  const photoLocations = new Map();
  for (const folder of allFolders) {
    for (const photoId of folder.photo_ids || []) {
      const norm = normalizePhotoId(photoId);
      if (!norm) continue;
      if (!photoLocations.has(norm)) photoLocations.set(norm, []);
      photoLocations.get(norm).push({ photoNorm: norm, folderId: folder.id, folder, photoId });
    }
  }

  const removalsByFolder = new Map();
  for (const [photoNorm, locations] of photoLocations) {
    if (locations.length <= 1) continue;
    const keeperId = pickKeeperFolderForPhoto(locations, membershipMap, canonicalNames);
    for (const location of locations) {
      if (location.folderId === keeperId) continue;
      if (!removalsByFolder.has(location.folderId)) removalsByFolder.set(location.folderId, new Set());
      removalsByFolder.get(location.folderId).add(photoNorm);
    }
  }

  if (!removalsByFolder.size) return allFolders;

  onProgress?.('Removing duplicate folder assignments…');

  let updatedFolders = [...allFolders];
  for (const [folderId, removeNorms] of removalsByFolder) {
    const folder = updatedFolders.find((entry) => entry.id === folderId);
    if (!folder) continue;
    const filtered = (folder.photo_ids || []).filter((id) => !removeNorms.has(normalizePhotoId(id)));
    if (filtered.length === (folder.photo_ids || []).length) continue;

    try {
      const saved = await updateFolderPhotoIdsWithTimeout(folderId, filtered, {}, ORGANIZE_SAVE_TIMEOUT_MS);
      updatedFolders = updatedFolders.map((entry) =>
        entry.id === folderId
          ? { ...entry, ...saved, photo_ids: saved.photo_ids || filtered }
          : entry,
      );
    } catch (error) {
      console.warn('enforceUniquePhotoMembership failed:', folder.name, error);
      updatedFolders = updatedFolders.map((entry) =>
        entry.id === folderId ? { ...entry, photo_ids: filtered } : entry,
      );
    }
  }

  return updatedFolders;
}

/** Local view model — strip duplicate photo membership before rendering. */
export function dedupePhotoMembershipInFolderList(
  folders,
  { membershipMap = {}, canonicalNames = ORGANIZE_BATCH_FOLDERS } = {},
) {
  const photoLocations = new Map();
  for (const folder of folders || []) {
    if (!folder?.id) continue;
    for (const photoId of folder.photo_ids || []) {
      const norm = normalizePhotoId(photoId);
      if (!norm) continue;
      if (!photoLocations.has(norm)) photoLocations.set(norm, []);
      photoLocations.get(norm).push({ photoNorm: norm, folderId: folder.id, folder, photoId });
    }
  }

  const removeFromFolder = new Map();
  for (const [, locations] of photoLocations) {
    if (locations.length <= 1) continue;
    const keeperId = pickKeeperFolderForPhoto(locations, membershipMap, canonicalNames);
    for (const location of locations) {
      if (location.folderId === keeperId) continue;
      if (!removeFromFolder.has(location.folderId)) removeFromFolder.set(location.folderId, new Set());
      removeFromFolder.get(location.folderId).add(location.photoNorm);
    }
  }

  if (!removeFromFolder.size) return folders || [];

  return (folders || []).map((folder) => {
    const removeNorms = removeFromFolder.get(folder.id);
    if (!removeNorms?.size) return folder;
    return {
      ...folder,
      photo_ids: (folder.photo_ids || []).filter((id) => !removeNorms.has(normalizePhotoId(id))),
    };
  });
}

async function removePhotosFromOtherFoldersOnServer(photoIds, keepFolderId, folders) {
  const removeNorm = new Set((photoIds || []).map(normalizePhotoId).filter(Boolean));
  if (!removeNorm.size || !keepFolderId) return folders;

  let allFolders = mergeApiFoldersWithLocal(
    await listAllFoldersSafe({ timeoutMs: 8000 }),
    folders || [],
  );

  let updatedFolders = [...allFolders];
  for (const folder of allFolders) {
    if (!folder?.id || folder.id === keepFolderId) continue;
    const currentIds = folder.photo_ids || [];
    const filtered = currentIds.filter((id) => !removeNorm.has(normalizePhotoId(id)));
    if (filtered.length === currentIds.length) continue;

    try {
      const saved = await updateFolderPhotoIdsWithTimeout(folder.id, filtered, {}, ORGANIZE_SAVE_TIMEOUT_MS);
      updatedFolders = updatedFolders.map((entry) =>
        entry.id === folder.id ? { ...entry, ...saved, photo_ids: saved.photo_ids || filtered } : entry,
      );
    } catch (error) {
      console.warn('Remove photo from duplicate folder failed:', folder.name, error);
      updatedFolders = updatedFolders.map((entry) =>
        entry.id === folder.id ? { ...entry, photo_ids: filtered } : entry,
      );
    }
  }

  return updatedFolders;
}

/** Gallery load: Folder.list (with timeout) + merged local snapshot fallback. */
export async function syncCachedFolderMembershipToServer(folders, photos, { maxUpdates = 16 } = {}) {
  if (!folders?.length || !photos?.length) return 0;

  const listed = await listAllFoldersSafe({ timeoutMs: 8000 });
  const serverById = new Map(listed.map((f) => [f.id, normalizeFolderRecord(f)]));
  let updates = 0;

  for (const folder of folders) {
    if (updates >= maxUpdates) break;
    if (!folder?.id) continue;

    const server = serverById.get(folder.id);
    if (!server) continue;

    const desiredIds = sanitizeFolderPhotoIds(folder.photo_ids, photos);
    const serverIds = sanitizeFolderPhotoIds(server.photo_ids, photos);
    const desiredNorm = new Set(desiredIds.map(normalizePhotoId));
    const serverNorm = new Set(serverIds.map(normalizePhotoId));

    let missingOnServer = false;
    for (const norm of desiredNorm) {
      if (!serverNorm.has(norm)) {
        missingOnServer = true;
        break;
      }
    }
    if (!missingOnServer) continue;

    try {
      await updateFolderPhotoIdsWithTimeout(
        folder.id,
        toStoredPhotoIds(desiredIds, photos),
        {},
        ORGANIZE_SAVE_TIMEOUT_MS,
      );
      updates += 1;
    } catch (error) {
      console.warn('syncCachedFolderMembershipToServer failed:', folder.name, error);
    }
  }

  return updates;
}

/** Gallery load: Folder.list (with timeout) + merged local snapshot fallback. */
export async function fetchGalleryFoldersWithMembership(email, photos = []) {
  const snapshot = email ? await loadFullFolderSnapshotAsync(email) : [];
  const listed = await listAllFoldersSafe();

  // Always merge API + local snapshot — never drop folders the API hasn't returned yet
  let folderSource = mergeApiFoldersWithLocal(listed, snapshot);

  let cached = await loadFolderMembershipCache(email);

  const validIds = new Set([
    ...folderSource.map((f) => f.id),
    ...snapshot.map((f) => f.id),
  ]);
  const pruned = {};
  for (const [photoNorm, folderId] of Object.entries(cached)) {
    if (validIds.has(folderId)) pruned[photoNorm] = folderId;
  }

  if (email && listed.length > 0 && Object.keys(pruned).length !== Object.keys(cached).length) {
    await saveFolderMembershipCache(email, pruned);
    cached = pruned;
  }

  let result = applyFolderMembershipCache(folderSource, photos, cached);
  result = mergeApiFoldersWithLocal(result, snapshot);
  result = dedupePhotoMembershipInFolderList(result, {
    membershipMap: cached,
    canonicalNames: ORGANIZE_BATCH_FOLDERS,
  });

  // Never shrink local snapshot — merge with what we already had on disk
  const snapshotOnDisk = email ? loadFolderSnapshotCacheSync(email) : [];
  const toPersist = dedupePhotoMembershipInFolderList(
    mergeApiFoldersWithLocal(result, snapshotOnDisk),
    { membershipMap: cached, canonicalNames: ORGANIZE_BATCH_FOLDERS },
  );

  if (email && toPersist.length > 0) {
    persistGalleryFoldersSync(email, toPersist);
    void persistGalleryFolders(email, toPersist);
  }

  if (email && photos.length > 0 && toPersist.length > 0) {
    void syncCachedFolderMembershipToServer(toPersist, photos);
  }

  return dedupeFoldersByNormalizedName(toPersist, ORGANIZE_BATCH_FOLDERS);
}
async function updateFolderPhotoIds(folderId, photoIds, extra = {}) {
  return updateFolderPhotoIdsWithTimeout(folderId, photoIds, extra);
}

async function appendPhotosToFolderOnServer(folderId, photos, userEmail) {
  const photoIds = (photos || []).map((p) => p.id).filter((id) => id != null);
  if (!photoIds.length) return getFolderOnServer(folderId);

  let base = await getFolderOnServer(folderId);
  const coverUrl = base.cover_photo_url || photos[0]?.file_url || '';

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(400);
      base = await getFolderOnServer(folderId);
    }
    const updatedIds = mergePhotoIdsLikeManualMove(base.photo_ids, photoIds);
    const updated = await updateFolderPhotoIdsWithTimeout(folderId, updatedIds, {
      ...(!base.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
    });
    if (photoIdsPersisted(updated?.photo_ids, photoIds)) {
      if (userEmail) {
        await recordBatchFolderMembership(
          userEmail,
          photos.map((photo) => ({ photoId: photo.id, folderId })),
        );
      }
      return updated;
    }
  }

  if (userEmail) {
    await recordBatchFolderMembership(
      userEmail,
      photos.map((photo) => ({ photoId: photo.id, folderId })),
    );
  }
  const last = await getFolderOnServer(folderId);
  return last || base;
}

async function appendPhotoToFolderOnServer(folderId, photo, userEmail) {
  return appendPhotosToFolderOnServer(folderId, [photo], userEmail);
}

async function appendPhotoIdsToFolderInChunks({
  folderId,
  photos,
  existingFolder,
  timeoutMs = ORGANIZE_SAVE_TIMEOUT_MS,
}) {
  let savedFolder = { ...existingFolder };
  let currentIds = [...(existingFolder.photo_ids || [])];
  const coverUrl = existingFolder.cover_photo_url || photos[0]?.file_url || '';

  for (let i = 0; i < photos.length; i += FOLDER_SAVE_CHUNK_SIZE) {
    const chunk = photos.slice(i, i + FOLDER_SAVE_CHUNK_SIZE);
    const chunkIds = chunk.map((photo) => photo.id);
    const updatedIds = mergePhotoIdsLikeManualMove(currentIds, chunkIds);
    try {
      const api = await updateFolderPhotoIdsWithTimeout(
        folderId,
        updatedIds,
        {
          ...(!savedFolder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
        },
        timeoutMs,
      );
      savedFolder = { ...savedFolder, ...api, photo_ids: api.photo_ids || updatedIds };
      currentIds = savedFolder.photo_ids || updatedIds;
    } catch (error) {
      console.warn('Folder chunk update failed:', error);
      savedFolder = { ...savedFolder, photo_ids: updatedIds };
      currentIds = updatedIds;
    }
  }

  return savedFolder;
}

/**
 * Assign loose photos grouped by folder name — one API write per folder, not per photo.
 */
export async function assignLoosePhotosByFolder({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  onProgress,
  onPartialSave,
  userEmail,
  canonicalFolderNames = ORGANIZE_BATCH_FOLDERS,
  maxFolderCount = ORGANIZE_BATCH_FOLDER_COUNT,
}) {
  const nameContext = canonicalFolderNames?.length ? canonicalFolderNames : ORGANIZE_BATCH_FOLDERS;
  let folders = dedupeFoldersByNormalizedName(liveFolders || [], nameContext);
  const folderByKey = new Map();
  for (const folder of folders) {
    const key = resolveOrganizeFolderName(folder.name, nameContext).toLowerCase();
    if (!folderByKey.has(key)) folderByKey.set(key, folder);
  }

  const groups = new Map();
  for (const photo of photosToAssign) {
    if (photo?.id == null) continue;
    const norm = normalizePhotoId(photo.id);
    const folderName = resolveOrganizeFolderName(
      labelByPhotoNormId.get(norm),
      nameContext,
    );
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName).push(photo);
  }

  let groupIndex = 0;
  const groupCount = groups.size;
  const cacheEntries = [];
  const failedPhotoIds = [];
  const foldersUsedKeys = new Set();

  for (const [folderName, groupPhotos] of groups) {
    groupIndex += 1;
    onProgress?.(`Batch ${groupIndex}/${groupCount}`);

    const photoIds = groupPhotos.map((p) => p.id);
    const targetKey = resolveOrganizeFolderName(folderName, nameContext).toLowerCase();
    let folderId = null;

    try {
      let target =
        folderByKey.get(targetKey)
        || findFolderByDisplayName(folders, folderName, nameContext);

      if (!target && folderByKey.size >= maxFolderCount) {
        target = pickOverflowFolder([...folderByKey.values()], nameContext);
      }

      if (target) {
        foldersUsedKeys.add(resolveOrganizeFolderName(target.name, nameContext).toLowerCase());
        const coverUrl = target.cover_photo_url || groupPhotos[0]?.file_url || '';
        let saved = target;
        try {
          if (groupPhotos.length <= FOLDER_SAVE_CHUNK_SIZE) {
            const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, photoIds);
            const api = await updateFolderPhotoIdsWithTimeout(
              target.id,
              updatedIds,
              {
                name: resolveOrganizeFolderName(folderName, nameContext),
                ...(!target.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
              },
              ORGANIZE_SAVE_TIMEOUT_MS,
            );
            saved = {
              ...target,
              ...api,
              name: resolveOrganizeFolderName(folderName, nameContext),
              photo_ids: api.photo_ids || updatedIds,
            };
          } else {
            saved = await appendPhotoIdsToFolderInChunks({
              folderId: target.id,
              photos: groupPhotos,
              existingFolder: target,
            });
            saved = { ...saved, name: resolveOrganizeFolderName(folderName, nameContext) };
          }
        } catch (error) {
          console.warn('Folder.update failed, using local state:', error);
          saved = {
            ...target,
            name: resolveOrganizeFolderName(folderName, nameContext),
            photo_ids: mergePhotoIdsLikeManualMove(target.photo_ids, photoIds),
            cover_photo_url: coverUrl || target.cover_photo_url,
          };
        }
        folderId = target.id;
        folders = folders.map((f) => (f.id === target.id ? saved : f));
        folderByKey.set(targetKey, saved);
        folders = await removePhotosFromOtherFoldersOnServer(photoIds, folderId, folders);
        for (const [key, folder] of [...folderByKey.entries()]) {
          if (folder.id === folderId) folderByKey.set(key, saved);
          else {
            const refreshed = folders.find((entry) => entry.id === folder.id);
            if (refreshed) folderByKey.set(key, refreshed);
          }
        }
      } else if (folderByKey.size < maxFolderCount) {
        const canonicalName = resolveOrganizeFolderName(folderName, nameContext);
        let created;
        try {
          const firstChunk = groupPhotos.slice(0, FOLDER_SAVE_CHUNK_SIZE);
          const rest = groupPhotos.slice(FOLDER_SAVE_CHUNK_SIZE);
          created = await createFolderOnServer(
            {
              name: canonicalName,
              description: '',
              photo_ids: firstChunk.map((photo) => photo.id),
              cover_photo_url: groupPhotos[0]?.file_url || '',
            },
            ORGANIZE_SAVE_TIMEOUT_MS,
          );
          if (rest.length) {
            created = await appendPhotoIdsToFolderInChunks({
              folderId: created.id,
              photos: rest,
              existingFolder: created,
            });
          }
        } catch (error) {
          console.warn('Folder.create failed:', error);
          failedPhotoIds.push(...photoIds);
          continue;
        }
        folderId = created.id;
        foldersUsedKeys.add(targetKey);
        const savedCreated = { ...created, name: canonicalName, photo_ids: created.photo_ids || photoIds };
        folders.push(savedCreated);
        folderByKey.set(targetKey, savedCreated);
        folders = await removePhotosFromOtherFoldersOnServer(photoIds, folderId, folders);
      } else {
        const overflow = pickOverflowFolder([...folderByKey.values()], nameContext);
        if (!overflow) {
          failedPhotoIds.push(...photoIds);
          continue;
        }
        const verified = await appendPhotosToFolderOnServer(overflow.id, groupPhotos, userEmail);
        folderId = overflow.id;
        const saved = { ...overflow, ...verified, photo_ids: verified?.photo_ids || overflow.photo_ids };
        folders = folders.map((f) => (f.id === overflow.id ? saved : f));
        folderByKey.set(targetKey, saved);
        folders = await removePhotosFromOtherFoldersOnServer(photoIds, folderId, folders);
      }

      for (const photo of groupPhotos) {
        cacheEntries.push({ photoId: photo.id, folderId });
      }

      onPartialSave?.(dedupeFoldersByNormalizedName(folders, nameContext));
    } catch (error) {
      console.warn('Folder group save failed:', folderName, error);
      failedPhotoIds.push(...photoIds);
    }
  }

  if (userEmail && cacheEntries.length) {
    void recordBatchFolderMembership(userEmail, cacheEntries);
  }

  return {
    folders: dedupeFoldersByNormalizedName(folders, nameContext),
    failedPhotoIds,
    foldersUsedInRun: foldersUsedKeys.size || groupCount,
  };
}

/**
 * Assign loose photos one at a time — used for small retry batches only.
 */
export async function assignLoosePhotosOneByOne({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  includeOrganized,
  onProgress,
  userEmail,
  canonicalFolderNames = ORGANIZE_BATCH_FOLDERS,
  maxFolderCount = ORGANIZE_BATCH_FOLDER_COUNT,
}) {
  const nameContext = canonicalFolderNames?.length ? canonicalFolderNames : ORGANIZE_BATCH_FOLDERS;
  let folders = dedupeFoldersByNormalizedName(liveFolders || [], nameContext);
  const folderByKey = new Map();
  for (const folder of folders) {
    const key = resolveOrganizeFolderName(folder.name, nameContext).toLowerCase();
    if (!folderByKey.has(key)) folderByKey.set(key, folder);
  }

  const total = photosToAssign.filter((p) => p?.id != null).length;
  let saved = 0;
  const cacheEntries = [];

  for (const photo of photosToAssign) {
    if (photo?.id == null) continue;
    saved += 1;
    onProgress?.(`Saving ${saved}/${total}…`);

    const norm = normalizePhotoId(photo.id);
    const folderName = resolveOrganizeFolderName(
      labelByPhotoNormId.get(norm),
      nameContext,
    );
    const targetKey = folderName.toLowerCase();
    let target =
      folderByKey.get(targetKey)
      || findFolderByDisplayName(folders, folderName, nameContext);

    if (!target && folderByKey.size >= maxFolderCount) {
      target = pickOverflowFolder([...folderByKey.values()], nameContext);
    }

    if (target) {
      const verified = await appendPhotoToFolderOnServer(target.id, photo, userEmail);
      const next = {
        ...target,
        ...verified,
        name: resolveOrganizeFolderName(folderName, nameContext),
        photo_ids: verified?.photo_ids || target.photo_ids,
      };
      folders = folders.map((f) => (f.id === target.id ? next : f));
      folderByKey.set(targetKey, next);
      folders = await removePhotosFromOtherFoldersOnServer([photo.id], target.id, folders);
      cacheEntries.push({ photoId: photo.id, folderId: target.id });
    } else if (folderByKey.size < maxFolderCount) {
      const canonicalName = resolveOrganizeFolderName(folderName, nameContext);
      const created = await createFolderOnServer({
        name: canonicalName,
        description: '',
        photo_ids: [photo.id],
        cover_photo_url: photo.file_url || '',
      });
      let verified = created;
      if (!photoIdsPersisted(created?.photo_ids, [photo.id])) {
        verified = await appendPhotoToFolderOnServer(created.id, photo, userEmail);
      } else if (userEmail) {
        await recordPhotoFolderMembership(userEmail, photo.id, created.id);
      }
      const next = {
        ...created,
        ...verified,
        name: canonicalName,
        photo_ids: verified?.photo_ids || [photo.id],
      };
      folders.push(next);
      folderByKey.set(targetKey, next);
      folders = await removePhotosFromOtherFoldersOnServer([photo.id], created.id, folders);
      cacheEntries.push({ photoId: photo.id, folderId: created.id });
    }
  }

  if (userEmail && cacheEntries.length) {
    await recordBatchFolderMembership(userEmail, cacheEntries);
  }

  return dedupeFoldersByNormalizedName(folders, nameContext);
}

/** @deprecated Use assignLoosePhotosOneByOne */
export async function assignLoosePhotosToFolders(options) {
  return assignLoosePhotosOneByOne(options);
}

export async function mergeFoldersIntoTarget({
  targetFolderId,
  sourceFolderIds,
  folders,
  photos,
  userEmail,
}) {
  const targetFolder = folders.find((f) => f.id === targetFolderId);
  if (!targetFolder) {
    throw new Error('Target folder not found');
  }

  const sources = sourceFolderIds.filter((id) => id !== targetFolderId);
  let mergedIds = [...(targetFolder.photo_ids || [])];

  for (const srcId of sources) {
    const src = folders.find((f) => f.id === srcId);
    if (src?.photo_ids?.length) {
      mergedIds = mergePhotoIdsLikeManualMove(mergedIds, src.photo_ids);
    }
  }

  mergedIds = toStoredPhotoIds(mergedIds, photos);

  const coverPhoto = photos.find(
    (p) => normalizePhotoId(p.id) === normalizePhotoId(mergedIds[0]),
  );
  const coverUrl = targetFolder.cover_photo_url || coverPhoto?.file_url || '';

  const verified = await updateFolderPhotoIds(targetFolderId, mergedIds, {
    ...(!targetFolder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
  });

  if (userEmail) {
    await recordBatchFolderMembership(
      userEmail,
      mergedIds.map((photoId) => ({ photoId, folderId: targetFolderId })),
    );
  }

  for (const srcId of sources) {
    await base44.entities.Folder.delete(srcId);
  }

  const updatedTarget = {
    ...targetFolder,
    ...verified,
    photo_ids: verified?.photo_ids || mergedIds,
    cover_photo_url: coverUrl || targetFolder.cover_photo_url,
  };

  return folders
    .filter((f) => !sources.includes(f.id))
    .map((f) => (f.id === targetFolderId ? updatedTarget : f));
}

export function mergeApiFoldersWithLocal(apiFolders, localFolders) {
  const apiById = new Map((apiFolders || []).map((f) => [f.id, normalizeFolderRecord(f)]));
  const localById = new Map((localFolders || []).map((f) => [f.id, normalizeFolderRecord(f)]));
  const allIds = new Set([...apiById.keys(), ...localById.keys()]);

  const merged = [];
  for (const id of allIds) {
    const api = apiById.get(id);
    const local = localById.get(id);
    if (api && local) {
      merged.push({
        ...api,
        ...local,
        photo_ids: mergePhotoIdsLikeManualMove(api.photo_ids, local.photo_ids),
      });
    } else if (local) {
      merged.push(local);
    } else if (api) {
      merged.push(api);
    }
  }
  return merged;
}

export async function reconcileOrganizeBatch({
  batchPhotos,
  afterFolders,
  labelByPhotoNormId,
  onProgress,
  userEmail,
  canonicalFolderNames = ORGANIZE_BATCH_FOLDERS,
}) {
  let desiredFolders = afterFolders || [];

  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(attempt === 0 ? 300 : 500 * attempt);
    let apiFolders = await listAllFolders();
    apiFolders = await mergeDuplicateFoldersOnServer(apiFolders, {
      onProgress,
      canonicalNames: canonicalFolderNames,
    });

    const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);
    if (missedPhotos.length === 0) {
      return {
        folders: dedupeFoldersByNormalizedName(
          mergeApiFoldersWithLocal(apiFolders, desiredFolders),
          canonicalFolderNames,
        ),
        apiFolders,
        totalSaved: batchPhotos.length,
        missed: 0,
      };
    }

    onProgress?.(`Retrying ${missedPhotos.length}… (${attempt + 1}/5)`);
    const retryResult = await assignLoosePhotosByFolder({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: mergeApiFoldersWithLocal(apiFolders, desiredFolders),
      onProgress,
      userEmail,
      canonicalFolderNames,
    });
    desiredFolders = retryResult.folders;
  }

  let apiFolders = await listAllFolders();
  apiFolders = await mergeDuplicateFoldersOnServer(apiFolders, {
    onProgress,
    canonicalNames: canonicalFolderNames,
  });
  const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);

  return {
    folders: dedupeFoldersByNormalizedName(
      mergeApiFoldersWithLocal(apiFolders, desiredFolders),
      canonicalFolderNames,
    ),
    apiFolders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}
