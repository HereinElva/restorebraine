import { base44 } from '@/api/base44Client';
import { normalizeFolderName } from '@/lib/media-organize';
import {
  getUnorganizedPhotos,
  normalizePhotoId,
  toStoredPhotoIds,
} from '@/lib/gallery-organize-snapshot';
import {
  applyFolderMembershipCache,
  loadFolderMembershipCache,
  recordBatchFolderMembership,
  recordPhotoFolderMembership,
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

function folderWritePayload(folder, overrides = {}) {
  const base = normalizeFolderRecord(folder);
  return {
    name: overrides.name ?? base.name,
    description: overrides.description ?? base.description ?? '',
    photo_ids: overrides.photo_ids ?? base.photo_ids ?? [],
    cover_photo_url: overrides.cover_photo_url ?? base.cover_photo_url ?? '',
  };
}

export async function listAllFolders() {
  const result = await base44.entities.Folder.list('-created_date', 200);
  return (result || []).map(normalizeFolderRecord);
}

/** Read full folder records — list() can return incomplete membership. */
export async function fetchFoldersWithFullMembership(folderIds = null) {
  const listed = await listAllFolders();
  const refreshIds = folderIds ? new Set(folderIds) : null;

  return Promise.all(
    listed.map(async (folder) => {
      if (!refreshIds || refreshIds.has(folder.id)) {
        try {
          const full = normalizeFolderRecord(await base44.entities.Folder.get(folder.id));
          return full || folder;
        } catch {
          return folder;
        }
      }
      return folder;
    }),
  );
}

/** Always read server state first, then PUT full folder payload (Base44 uses PUT). */
async function updateFolderOnServer(folderId, overrides = {}) {
  const current = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
  const payload = folderWritePayload(current, overrides);
  const updated = normalizeFolderRecord(
    await base44.entities.Folder.update(folderId, payload),
  );
  return updated?.photo_ids?.length ? updated : { ...current, ...payload };
}

async function appendPhotoToFolderOnServer(folderId, photo, userEmail) {
  const current = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
  const updatedIds = mergePhotoIdsLikeManualMove(current.photo_ids, [photo.id]);
  const coverUrl = current.cover_photo_url || photo.file_url || '';

  let saved = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(300 * attempt);
    const base =
      attempt === 0
        ? current
        : normalizeFolderRecord(await base44.entities.Folder.get(folderId));
    saved = await updateFolderOnServer(folderId, {
      photo_ids: mergePhotoIdsLikeManualMove(base.photo_ids, [photo.id]),
      ...(!base.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
    });
    const verified = normalizeFolderRecord(await base44.entities.Folder.get(folderId));
    if (photoIdsPersisted(verified?.photo_ids, [photo.id])) {
      if (userEmail) await recordPhotoFolderMembership(userEmail, photo.id, folderId);
      return verified;
    }
  }

  if (userEmail) await recordPhotoFolderMembership(userEmail, photo.id, folderId);
  return saved || { ...current, photo_ids: updatedIds };
}

/**
 * Assign loose photos one at a time — read-modify-write from server each time.
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

/** @deprecated Use assignLoosePhotosOneByOne — batch updates can race on PUT. */
export async function assignLoosePhotosToFolders(options) {
  return assignLoosePhotosOneByOne(options);
}

/**
 * Move all media from source folder(s) into a target folder, then delete the source folder(s).
 */
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

  const verified = await updateFolderOnServer(targetFolderId, {
    photo_ids: mergedIds,
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

/** Merge API folder list with in-memory saves — prefer API photo_ids when present. */
export function mergeApiFoldersWithLocal(apiFolders, localFolders) {
  const apiById = new Map((apiFolders || []).map((f) => [f.id, normalizeFolderRecord(f)]));
  const localById = new Map((localFolders || []).map((f) => [f.id, normalizeFolderRecord(f)]));
  const allIds = new Set([...apiById.keys(), ...localById.keys()]);

  const merged = [];
  for (const id of allIds) {
    const api = apiById.get(id);
    const local = localById.get(id);
    if (api && local) {
      const apiHasIds = (api.photo_ids || []).length > 0;
      merged.push({
        ...api,
        ...local,
        photo_ids: apiHasIds
          ? mergePhotoIdsLikeManualMove(api.photo_ids, local.photo_ids)
          : local.photo_ids || api.photo_ids || [],
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
  const touchedIds = desiredFolders.map((f) => f.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt === 0 ? 300 : 500 * attempt);
    const apiFolders = await fetchFoldersWithFullMembership(touchedIds);

    let missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);
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
    touchedIds.splice(0, touchedIds.length, ...desiredFolders.map((f) => f.id));
  }

  const apiFolders = await fetchFoldersWithFullMembership(touchedIds);
  const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);

  return {
    folders: mergeApiFoldersWithLocal(apiFolders, desiredFolders),
    apiFolders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}

/** Gallery load: full membership from API + local cache backup. */
export async function fetchGalleryFoldersWithMembership(email, photos = []) {
  const apiFolders = await fetchFoldersWithFullMembership();
  const filtered = apiFolders.filter((f) => !f.created_by || f.created_by === email);
  const cached = await loadFolderMembershipCache(email);
  return applyFolderMembershipCache(filtered, photos, cached);
}
