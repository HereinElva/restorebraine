import { base44 } from '@/api/base44Client';
import { normalizeFolderName } from '@/lib/media-organize';
import { getUnorganizedPhotos, normalizePhotoId } from '@/lib/gallery-organize-snapshot';

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

/**
 * Assign loose photos to folders one at a time using the same update pattern as manual move.
 * Returns the updated in-memory folder list (authoritative for UI cache).
 */
export async function assignLoosePhotosToFolders({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  existingFolderNames,
  includeOrganized,
  onProgress,
}) {
  let folders = [...liveFolders];
  const names = () => folders.map((f) => f.name);
  const total = photosToAssign.length;

  for (let i = 0; i < total; i++) {
    const photo = photosToAssign[i];
    if (photo?.id == null) continue;

    onProgress?.(`Saving ${i + 1}/${total}…`);

    const norm = normalizePhotoId(photo.id);
    const folderName = normalizeFolderName(
      labelByPhotoNormId.get(norm) || 'Miscellaneous',
      names(),
    );

    let target = findFolderByDisplayName(folders, folderName, names());

    if (target && !includeOrganized) {
      const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, [photo.id]);
      const coverUrl = target.cover_photo_url || photo.file_url || '';
      await base44.entities.Folder.update(target.id, {
        photo_ids: updatedIds,
        ...(!target.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
      });
      folders = folders.map((f) =>
        f.id === target.id ? { ...f, photo_ids: updatedIds } : f,
      );
    } else if (target && includeOrganized) {
      const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, [photo.id]);
      await base44.entities.Folder.update(target.id, {
        photo_ids: updatedIds,
        cover_photo_url: target.cover_photo_url || photo.file_url || '',
      });
      folders = folders.map((f) =>
        f.id === target.id ? { ...f, photo_ids: updatedIds } : f,
      );
    } else {
      const created = await base44.entities.Folder.create({
        name: folderName,
        description: '',
        photo_ids: [photo.id],
        cover_photo_url: photo.file_url || '',
      });
      folders.push({
        ...created,
        name: folderName,
        photo_ids: [photo.id],
        cover_photo_url: photo.file_url || created.cover_photo_url || '',
      });
    }
  }

  return folders;
}

/**
 * Move all media from source folder(s) into a target folder, then delete the source folder(s).
 * Same reliable photo_id merge as manual move. Returns updated in-memory folder list for cache.
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

  const coverPhoto = photos.find(
    (p) => normalizePhotoId(p.id) === normalizePhotoId(mergedIds[0]),
  );
  const coverUrl = targetFolder.cover_photo_url || coverPhoto?.file_url || '';

  await base44.entities.Folder.update(targetFolderId, {
    photo_ids: mergedIds,
    ...(!targetFolder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
  });

  for (const srcId of sources) {
    await base44.entities.Folder.delete(srcId);
  }

  const updatedTarget = {
    ...targetFolder,
    photo_ids: mergedIds,
    cover_photo_url: coverUrl || targetFolder.cover_photo_url,
  };

  return folders
    .filter((f) => !sources.includes(f.id))
    .map((f) => (f.id === targetFolderId ? updatedTarget : f));
}

/**
 * Merge API folder list with in-memory saves from organize / manual moves.
 * Keeps folders created locally that the API has not listed yet, and unions photo_ids.
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

/** Re-save any batch photos still loose after cache sync; returns updated folder list. */
export async function reconcileOrganizeBatch({
  batchPhotos,
  afterFolders,
  labelByPhotoNormId,
  onProgress,
}) {
  let folders = afterFolders || [];
  let missedPhotos = getUnorganizedPhotos(batchPhotos, folders);

  for (let attempt = 0; attempt < 2 && missedPhotos.length > 0; attempt++) {
    onProgress?.(`Syncing ${missedPhotos.length} remaining…`);
    const apiFolders = await base44.entities.Folder.list();
    folders = mergeApiFoldersWithLocal(apiFolders, folders);
    folders = await assignLoosePhotosToFolders({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: folders,
      existingFolderNames: folders.map((f) => f.name),
      includeOrganized: false,
      onProgress,
    });
    missedPhotos = getUnorganizedPhotos(batchPhotos, folders);
  }

  const apiFolders = await base44.entities.Folder.list();
  folders = mergeApiFoldersWithLocal(apiFolders, folders);

  return {
    folders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}
