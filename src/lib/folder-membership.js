import { base44 } from '@/api/base44Client';
import { normalizeFolderName } from '@/lib/media-organize';
import {
  getUnorganizedPhotos,
  normalizePhotoId,
  toStoredPhotoIds,
} from '@/lib/gallery-organize-snapshot';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/** Update folder membership and verify with Folder.get before continuing. */
export async function updateFolderPhotoIdsVerified(folderId, photoIds, extra = {}) {
  const payload = { photo_ids: photoIds, ...extra };

  for (let attempt = 0; attempt < 4; attempt++) {
    await base44.entities.Folder.update(folderId, payload);
    if (attempt > 0) await sleep(250 * attempt);

    try {
      const fetched = await base44.entities.Folder.get(folderId);
      if (photoIdsPersisted(fetched?.photo_ids, photoIds)) {
        return fetched;
      }
    } catch (error) {
      console.warn('Folder.get verify failed:', error);
    }
  }

  try {
    return await base44.entities.Folder.get(folderId);
  } catch {
    return null;
  }
}

/**
 * Assign loose photos to folders — one verified Folder.update per target folder.
 * Returns the updated in-memory folder list.
 */
export async function assignLoosePhotosToFolders({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  existingFolderNames,
  includeOrganized,
  photos,
  onProgress,
}) {
  let folders = [...liveFolders];
  const names = () => folders.map((f) => f.name);
  const total = photosToAssign.filter((p) => p?.id != null).length;
  let saved = 0;

  const groups = new Map();
  for (const photo of photosToAssign) {
    if (photo?.id == null) continue;
    const norm = normalizePhotoId(photo.id);
    const folderName = normalizeFolderName(
      labelByPhotoNormId.get(norm) || 'Miscellaneous',
      names(),
    );
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName).push(photo);
  }

  for (const [folderName, groupPhotos] of groups) {
    let target = findFolderByDisplayName(folders, folderName, names());
    const photoIds = toStoredPhotoIds(
      groupPhotos.map((p) => p.id),
      photos || groupPhotos,
    );
    const coverUrl =
      target?.cover_photo_url || groupPhotos.find((p) => p.file_url)?.file_url || '';

    if (target && !includeOrganized) {
      const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, photoIds);
      saved += groupPhotos.length;
      onProgress?.(`Saving ${saved}/${total}…`);
      const verified = await updateFolderPhotoIdsVerified(target.id, updatedIds, {
        ...(!target.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
      });
      folders = folders.map((f) =>
        f.id === target.id
          ? { ...f, photo_ids: verified?.photo_ids || updatedIds }
          : f,
      );
    } else if (target && includeOrganized) {
      const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, photoIds);
      saved += groupPhotos.length;
      onProgress?.(`Saving ${saved}/${total}…`);
      const verified = await updateFolderPhotoIdsVerified(target.id, updatedIds, {
        cover_photo_url: target.cover_photo_url || coverUrl,
      });
      folders = folders.map((f) =>
        f.id === target.id
          ? { ...f, photo_ids: verified?.photo_ids || updatedIds }
          : f,
      );
    } else {
      saved += groupPhotos.length;
      onProgress?.(`Saving ${saved}/${total}…`);
      const created = await base44.entities.Folder.create({
        name: folderName,
        description: '',
        photo_ids: photoIds,
        cover_photo_url: coverUrl,
      });
      let verified = created;
      if (!photoIdsPersisted(created?.photo_ids, photoIds)) {
        verified = await updateFolderPhotoIdsVerified(created.id, photoIds, {
          cover_photo_url: coverUrl || created.cover_photo_url || '',
        });
      }
      folders.push({
        ...created,
        ...verified,
        name: folderName,
        photo_ids: verified?.photo_ids || photoIds,
        cover_photo_url: coverUrl || verified?.cover_photo_url || created.cover_photo_url || '',
      });
    }
  }

  return folders;
}

/**
 * Push folder membership to the API when the server list is behind local saves.
 * Uses Folder.get to verify each write.
 */
export async function persistFolderMembershipToApi(desiredFolders, photos, onProgress) {
  let wrote = 0;

  for (const desired of desiredFolders || []) {
    const desiredIds = toStoredPhotoIds(desired.photo_ids, photos);
    if (!desiredIds.length) continue;

    let apiFolder;
    try {
      apiFolder = await base44.entities.Folder.get(desired.id);
    } catch {
      continue;
    }

    const merged = mergePhotoIdsLikeManualMove(apiFolder?.photo_ids, desiredIds);
    const apiNorm = new Set((apiFolder?.photo_ids || []).map(normalizePhotoId));
    const needsUpdate = merged.some((id) => !apiNorm.has(normalizePhotoId(id)));

    if (needsUpdate) {
      onProgress?.(`Syncing "${desired.name}"…`);
      await updateFolderPhotoIdsVerified(desired.id, merged);
      wrote += 1;
    }
  }

  if (wrote > 0) await sleep(300);
  return listAllFolders();
}

export async function listAllFolders() {
  const result = await base44.entities.Folder.list('-created_date', 200);
  return result || [];
}

/**
 * Move all media from source folder(s) into a target folder, then delete the source folder(s).
 */
export async function mergeFoldersIntoTarget({
  targetFolderId,
  sourceFolderIds,
  folders,
  photos,
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

  const verified = await updateFolderPhotoIdsVerified(targetFolderId, mergedIds, {
    ...(!targetFolder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
  });

  for (const srcId of sources) {
    await base44.entities.Folder.delete(srcId);
  }

  const updatedTarget = {
    ...targetFolder,
    photo_ids: verified?.photo_ids || mergedIds,
    cover_photo_url: coverUrl || targetFolder.cover_photo_url,
  };

  return folders
    .filter((f) => !sources.includes(f.id))
    .map((f) => (f.id === targetFolderId ? updatedTarget : f));
}

/**
 * Merge API folder list with in-memory saves from organize / manual moves.
 */
export function mergeApiFoldersWithLocal(apiFolders, localFolders) {
  const apiById = new Map((apiFolders || []).map((f) => [f.id, f]));
  const localById = new Map((localFolders || []).map((f) => [f.id, f]));
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

/**
 * Re-save batch photos still missing from the API after organize.
 * Uses Folder.get / Folder.list (server truth) — never merged cache alone.
 */
export async function reconcileOrganizeBatch({
  batchPhotos,
  afterFolders,
  labelByPhotoNormId,
  photos,
  onProgress,
}) {
  let desiredFolders = afterFolders || [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const apiFolders = await persistFolderMembershipToApi(desiredFolders, photos, onProgress);
    desiredFolders = mergeApiFoldersWithLocal(apiFolders, desiredFolders);

    const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);
    if (missedPhotos.length === 0) {
      return {
        folders: desiredFolders,
        apiFolders,
        totalSaved: batchPhotos.length,
        missed: 0,
      };
    }

    onProgress?.(`Retrying ${missedPhotos.length} on server… (${attempt + 1}/3)`);
    desiredFolders = await assignLoosePhotosToFolders({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: desiredFolders,
      existingFolderNames: desiredFolders.map((f) => f.name),
      includeOrganized: false,
      photos,
      onProgress,
    });
  }

  const apiFolders = await persistFolderMembershipToApi(desiredFolders, photos, onProgress);
  desiredFolders = mergeApiFoldersWithLocal(apiFolders, desiredFolders);
  const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);

  return {
    folders: desiredFolders,
    apiFolders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}
