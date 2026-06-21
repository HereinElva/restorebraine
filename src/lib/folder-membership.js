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

/** Read full folder records — list() can lag behind or omit photo_ids. */
export async function fetchFoldersWithFullMembership(folderIds = null) {
  const listed = await listAllFolders();
  const refreshIds = folderIds ? new Set(folderIds) : null;

  return Promise.all(
    listed.map(async (folder) => {
      if (!refreshIds || refreshIds.has(folder.id)) {
        try {
          const full = await base44.entities.Folder.get(folder.id);
          return full || folder;
        } catch {
          return folder;
        }
      }
      return folder;
    }),
  );
}

/** Same pattern as MobilePhotoModal.handleMoveToFolder — one photo, one update. */
async function appendPhotoToFolder(folder, photo) {
  const updatedIds = mergePhotoIdsLikeManualMove(folder.photo_ids, [photo.id]);
  const coverUrl = folder.cover_photo_url || photo.file_url || '';
  const updated = await base44.entities.Folder.update(folder.id, {
    photo_ids: updatedIds,
    ...(!folder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
  });
  return {
    ...folder,
    ...updated,
    photo_ids: updated?.photo_ids || updatedIds,
    cover_photo_url: coverUrl || updated?.cover_photo_url || folder.cover_photo_url,
  };
}

/**
 * Assign loose photos one at a time — most reliable save path (matches manual move).
 */
export async function assignLoosePhotosOneByOne({
  photosToAssign,
  labelByPhotoNormId,
  liveFolders,
  includeOrganized,
  onProgress,
}) {
  let folders = [...liveFolders];
  const names = () => folders.map((f) => f.name);
  const total = photosToAssign.filter((p) => p?.id != null).length;
  let saved = 0;

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

    if (target && !includeOrganized) {
      const updated = await appendPhotoToFolder(target, photo);
      folders = folders.map((f) => (f.id === target.id ? updated : f));
    } else if (target && includeOrganized) {
      const updated = await appendPhotoToFolder(target, photo);
      folders = folders.map((f) => (f.id === target.id ? updated : f));
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
        photo_ids: created?.photo_ids || [photo.id],
        cover_photo_url: photo.file_url || created?.cover_photo_url || '',
      });
    }
  }

  return folders;
}

/**
 * Assign loose photos to folders — batch by folder, fall back to one-by-one for any missed.
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
    const photoIds = groupPhotos.map((p) => p.id);
    const coverUrl =
      target?.cover_photo_url || groupPhotos.find((p) => p.file_url)?.file_url || '';

    if (target) {
      const updatedIds = mergePhotoIdsLikeManualMove(target.photo_ids, photoIds);
      saved += groupPhotos.length;
      onProgress?.(`Saving ${saved}/${total}…`);
      const updated = await base44.entities.Folder.update(target.id, {
        photo_ids: updatedIds,
        ...(!target.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
      });
      folders = folders.map((f) =>
        f.id === target.id
          ? { ...f, ...updated, photo_ids: updated?.photo_ids || updatedIds }
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
      folders.push({
        ...created,
        name: folderName,
        photo_ids: created?.photo_ids || photoIds,
        cover_photo_url: coverUrl || created?.cover_photo_url || '',
      });
    }
  }

  return folders;
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

  const updated = await base44.entities.Folder.update(targetFolderId, {
    photo_ids: mergedIds,
    ...(!targetFolder.cover_photo_url && coverUrl ? { cover_photo_url: coverUrl } : {}),
  });

  for (const srcId of sources) {
    await base44.entities.Folder.delete(srcId);
  }

  const updatedTarget = {
    ...targetFolder,
    ...updated,
    photo_ids: updated?.photo_ids || mergedIds,
    cover_photo_url: coverUrl || targetFolder.cover_photo_url,
  };

  return folders
    .filter((f) => !sources.includes(f.id))
    .map((f) => (f.id === targetFolderId ? updatedTarget : f));
}

/** Merge API folder list with in-memory saves from organize / manual moves. */
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
 * Confirm batch photos on server; retry one-by-one for any still loose.
 */
export async function reconcileOrganizeBatch({
  batchPhotos,
  afterFolders,
  labelByPhotoNormId,
  onProgress,
}) {
  let desiredFolders = afterFolders || [];
  const touchedIds = desiredFolders.map((f) => f.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(attempt === 0 ? 200 : 400 * attempt);
    let apiFolders = await fetchFoldersWithFullMembership(touchedIds);
    desiredFolders = mergeApiFoldersWithLocal(apiFolders, desiredFolders);

    let missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);
    if (missedPhotos.length === 0) {
      return {
        folders: desiredFolders,
        apiFolders,
        totalSaved: batchPhotos.length,
        missed: 0,
      };
    }

    onProgress?.(`Retrying ${missedPhotos.length}… (${attempt + 1}/3)`);
    desiredFolders = await assignLoosePhotosOneByOne({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: desiredFolders,
      includeOrganized: false,
      onProgress,
    });
    touchedIds.splice(0, touchedIds.length, ...desiredFolders.map((f) => f.id));
  }

  const apiFolders = await fetchFoldersWithFullMembership(touchedIds);
  desiredFolders = mergeApiFoldersWithLocal(apiFolders, desiredFolders);
  const missedPhotos = getUnorganizedPhotos(batchPhotos, apiFolders);

  return {
    folders: desiredFolders,
    apiFolders,
    totalSaved: batchPhotos.length - missedPhotos.length,
    missed: missedPhotos.length,
  };
}
