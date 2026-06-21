import { base44 } from '@/api/base44Client';
import { normalizeFolderName } from '@/lib/media-organize';
import {
  getUnorganizedPhotos,
  normalizePhotoId,
  toStoredPhotoIds,
} from '@/lib/gallery-organize-snapshot';
import {
  applyFolderMembershipCache,
  clearFolderMembershipCache,
  loadFolderMembershipCache,
  recordBatchFolderMembership,
  recordPhotoFolderMembership,
  saveFolderMembershipCache,
} from '@/lib/folder-membership-cache';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return folders.find(
    (f) => normalizeFolderName(f.name, existingFolderNames).toLowerCase() === targetKey,
  );
}

function photoIdsPersisted(persistedIds, expectedIds) {
  const persistedNorm = new Set((persistedIds || []).map(normalizePhotoId));
  return (expectedIds || []).every((id) => persistedNorm.has(normalizePhotoId(id)));
}

export async function listAllFolders() {
  const result = await base44.entities.Folder.list('-created_date', 200);
  return (result || []).map(normalizeFolderRecord);
}

const FOLDER_DELETE_TIMEOUT_MS = 8000;

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

/** Gallery load: Folder.list + pruned local membership cache. */
export async function fetchGalleryFoldersWithMembership(email, photos = []) {
  const listed = await listAllFolders();
  let cached = await loadFolderMembershipCache(email);

  const validIds = new Set(listed.map((f) => f.id));
  const pruned = {};
  for (const [photoNorm, folderId] of Object.entries(cached)) {
    if (validIds.has(folderId)) pruned[photoNorm] = folderId;
  }

  if (email) {
    if (listed.length === 0 && Object.keys(cached).length > 0) {
      await clearFolderMembershipCache(email);
      cached = {};
    } else if (Object.keys(pruned).length !== Object.keys(cached).length) {
      await saveFolderMembershipCache(email, pruned);
      cached = pruned;
    }
  }

  return applyFolderMembershipCache(listed, photos, cached);
}
async function updateFolderPhotoIds(folderId, photoIds, extra = {}) {
  const updated = await base44.entities.Folder.update(folderId, {
    photo_ids: photoIds,
    ...extra,
  });
  return normalizeFolderRecord(updated);
}

async function appendPhotoToFolderOnServer(folderId, photo, userEmail) {
  let base = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
  const coverUrl = base.cover_photo_url || photo.file_url || '';

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(300 * attempt);
      base = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
    }
    const updatedIds = mergePhotoIdsLikeManualMove(base.photo_ids, [photo.id]);
    await updateFolderPhotoIds(folderId, updatedIds, {
      ...(!base.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
    });
    const verified = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
    if (photoIdsPersisted(verified?.photo_ids, [photo.id])) {
      if (userEmail) await recordPhotoFolderMembership(userEmail, photo.id, folderId);
      return verified;
    }
  }

  if (userEmail) await recordPhotoFolderMembership(userEmail, photo.id, folderId);
  const last = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
  return last || base;
}

/**
 * Assign loose photos one at a time — read-modify-write from server, partial update only.
 */
export async function assignLoosePhotosOneByOne({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  includeOrganized,
  onProgress,
  userEmail,
}) {
  let folders = [...liveFolders];
  const names = () => folders.map((f) => f.name);
  const total = photosToAssign.filter((p) => p?.id != null).length;
  let saved = 0;
  const cacheEntries = [];

  for (const photo of photosToAssign) {
    if (photo?.id == null) continue;
    saved += 1;
    onProgress?.(`Saving ${saved}/${total}…`);

    const norm = normalizePhotoId(photo.id);
    const folderName = normalizeFolderName(
      labelByPhotoNormId.get(norm) || 'Miscellaneous',
      names(),
    );
    let target = findFolderByDisplayName(folders, folderName, names());

    if (target) {
      const verified = await appendPhotoToFolderOnServer(target.id, photo, userEmail);
      folders = folders.map((f) =>
        f.id === target.id ? { ...f, ...verified, photo_ids: verified?.photo_ids || f.photo_ids } : f,
      );
      cacheEntries.push({ photoId: photo.id, folderId: target.id });
    } else {
      const created = normalizeFolderRecord(
        await base44.entities.Folder.create({
          name: folderName,
          description: '',
          photo_ids: [photo.id],
          cover_photo_url: photo.file_url || '',
        }),
      );
      let verified = created;
      if (!photoIdsPersisted(created?.photo_ids, [photo.id])) {
        verified = await appendPhotoToFolderOnServer(created.id, photo, userEmail);
      } else if (userEmail) {
        await recordPhotoFolderMembership(userEmail, photo.id, created.id);
      }
      folders.push({
        ...created,
        ...verified,
        name: folderName,
        photo_ids: verified?.photo_ids || [photo.id],
      });
      cacheEntries.push({ photoId: photo.id, folderId: created.id });
    }
  }

  if (userEmail && cacheEntries.length) {
    await recordBatchFolderMembership(userEmail, cacheEntries);
  }

  return folders;
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
}) {
  let desiredFolders = afterFolders || [];

  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt === 0 ? 300 : 500 * attempt);
    const apiFolders = await listAllFolders();

    const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);
    if (missedPhotos.length === 0) {
      return {
        folders: mergeApiFoldersWithLocal(apiFolders, desiredFolders),
        apiFolders,
        totalSaved: batchPhotos.length,
        missed: 0,
      };
    }

    onProgress?.(`Retrying ${missedPhotos.length}… (${attempt + 1}/3)`);
    desiredFolders = await assignLoosePhotosOneByOne({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: mergeApiFoldersWithLocal(apiFolders, desiredFolders),
      includeOrganized: false,
      onProgress,
      userEmail,
    });
  }

  const apiFolders = await listAllFolders();
  const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);

  return {
    folders: mergeApiFoldersWithLocal(apiFolders, desiredFolders),
    apiFolders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}
