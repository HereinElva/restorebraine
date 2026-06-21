import { base44 } from '@/api/base44Client';
import { normalizeFolderName } from '@/lib/media-organize';
import { normalizePhotoId } from '@/lib/gallery-organize-snapshot';

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
