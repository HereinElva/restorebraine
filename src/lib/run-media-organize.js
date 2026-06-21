import { base44 } from "@/api/base44Client";
import { reanalyzeWeakPhotos } from "@/lib/media-analysis";
import { isWeakMetadata } from "@/lib/media-tags";
import {
  assignFolderLocally,
  mergeFolderGroupsLocally,
  normalizeFolderName,
} from "@/lib/media-organize";

const MISC_FOLDER = "Miscellaneous";

async function runConcurrent(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;
  async function runNext() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, runNext));
  return results;
}

function filterValidIds(ids, validPhotoIds) {
  return (ids || []).filter((id) => validPhotoIds.has(id));
}

/** Drop stale IDs from folders so Recents matches what Organize will process. */
async function sanitizeFolderMembership(folders, allPhotoIds) {
  const tasks = folders.map((folder) => async () => {
    const cleaned = [...new Set((folder.photo_ids || []).filter((id) => allPhotoIds.has(id)))];
    if (cleaned.length !== (folder.photo_ids || []).length) {
      await base44.entities.Folder.update(folder.id, { photo_ids: cleaned });
      return { ...folder, photo_ids: cleaned };
    }
    return folder;
  });
  return runConcurrent(tasks, 5);
}

function buildGroupsFromLocalTags(photosToOrganize, existingFolderNames, validPhotoIds) {
  const groupMap = new Map();

  for (const photo of photosToOrganize) {
    if (!validPhotoIds.has(photo.id)) continue;
    const folder = assignFolderLocally(photo);
    const display = normalizeFolderName(folder, existingFolderNames);
    const key = display.toLowerCase();
    if (!groupMap.has(key)) groupMap.set(key, { name: display, ids: new Set() });
    groupMap.get(key).ids.add(photo.id);
  }

  return Array.from(groupMap.values()).map((g) => ({
    name: g.name,
    ids: [...g.ids],
  }));
}

function assignRemainingPhotos(folders, photosToOrganize, validPhotoIds) {
  const assigned = new Set(folders.flatMap((f) => f.photo_ids));
  const remaining = photosToOrganize
    .map((p) => p.id)
    .filter((id) => validPhotoIds.has(id) && !assigned.has(id));

  if (remaining.length === 0) return folders;

  const miscKey = MISC_FOLDER.toLowerCase();
  const miscFolder = folders.find((f) => f.name.toLowerCase() === miscKey);
  if (miscFolder) {
    miscFolder.photo_ids = [...new Set([...miscFolder.photo_ids, ...remaining])];
  } else {
    folders.push({ name: MISC_FOLDER, photo_ids: remaining });
  }

  return folders;
}

async function cleanupEmptyFolders(allPhotoIds) {
  const folders = await base44.entities.Folder.list();
  const emptyFolders = folders.filter((f) => {
    const validIds = (f.photo_ids || []).filter((id) => allPhotoIds.has(id));
    return validIds.length === 0;
  });

  if (emptyFolders.length > 0) {
    await runConcurrent(
      emptyFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
      5
    );
  }
}

export async function runMediaOrganize({
  photos,
  includeOrganized,
  sharpenTags,
  customInstructions: _customInstructions,
  onProgress,
}) {
  const allPhotoIds = new Set(photos.map((p) => p.id));

  let existingFolders = await base44.entities.Folder.list();
  existingFolders = await sanitizeFolderMembership(existingFolders, allPhotoIds);
  await cleanupEmptyFolders(allPhotoIds);
  existingFolders = await base44.entities.Folder.list();

  const organizedPhotoIds = new Set(existingFolders.flatMap((f) => f.photo_ids || []));
  const existingFolderNames = existingFolders.map((f) => f.name);

  let photosToOrganize = includeOrganized
    ? photos
    : photos.filter((p) => !organizedPhotoIds.has(p.id));

  if (photosToOrganize.length === 0) {
    return {
      ok: false,
      reason: includeOrganized
        ? "No photos to organize."
        : "All photos are already in folders. Check 'Re-organize everything' to re-sort.",
    };
  }

  const validPhotoIds = new Set(photosToOrganize.map((p) => p.id));

  if (includeOrganized && existingFolders.length > 0) {
    onProgress?.(`Clearing ${existingFolders.length} existing folders…`);
    await runConcurrent(
      existingFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
      5
    );
    existingFolders = [];
  }

  if (sharpenTags) {
    const weakInBatch = photosToOrganize.filter(isWeakMetadata).length;
    if (weakInBatch > 0) {
      onProgress?.(`Sharpening tags for ${weakInBatch} item${weakInBatch !== 1 ? "s" : ""}…`);
      photosToOrganize = await reanalyzeWeakPhotos(photosToOrganize, { onProgress });
    }
  }

  onProgress?.(`Sorting ${photosToOrganize.length} unsorted item${photosToOrganize.length !== 1 ? "s" : ""}…`);

  const initialGroups = buildGroupsFromLocalTags(
    photosToOrganize,
    includeOrganized ? [] : existingFolderNames,
    validPhotoIds
  );

  let finalFolders = mergeFolderGroupsLocally(
    initialGroups,
    includeOrganized ? [] : existingFolderNames
  );

  finalFolders = assignRemainingPhotos(finalFolders, photosToOrganize, validPhotoIds);

  onProgress?.(`Saving ${finalFolders.length} folder${finalFolders.length !== 1 ? "s" : ""}…`);

  const currentFolders = includeOrganized ? [] : existingFolders;

  const seenThisRun = new Set();
  const foldersToSave = [];
  for (const folder of finalFolders) {
    const uniqueIds = filterValidIds(folder.photo_ids, validPhotoIds).filter((id) => {
      if (seenThisRun.has(id)) return false;
      seenThisRun.add(id);
      return true;
    });
    if (uniqueIds.length >= 1) {
      foldersToSave.push({ ...folder, photo_ids: uniqueIds });
    }
  }

  const stillUnassigned = photosToOrganize
    .map((p) => p.id)
    .filter((id) => !seenThisRun.has(id));
  if (stillUnassigned.length > 0) {
    const miscKey = MISC_FOLDER.toLowerCase();
    const miscFolder = foldersToSave.find((f) => f.name.toLowerCase() === miscKey);
    if (miscFolder) {
      for (const id of stillUnassigned) {
        if (!seenThisRun.has(id)) {
          miscFolder.photo_ids.push(id);
          seenThisRun.add(id);
        }
      }
      miscFolder.photo_ids = [...new Set(miscFolder.photo_ids)];
    } else {
      foldersToSave.push({ name: MISC_FOLDER, photo_ids: stillUnassigned });
      stillUnassigned.forEach((id) => seenThisRun.add(id));
    }
  }

  const folderTasks = foldersToSave.map((folder) => async () => {
    const matchingFolder = currentFolders.find(
      (f) => f.name.toLowerCase() === folder.name.toLowerCase()
    );

    if (matchingFolder) {
      const mergedIds = [
        ...new Set([
          ...filterValidIds(matchingFolder.photo_ids, allPhotoIds),
          ...folder.photo_ids,
        ]),
      ];
      const coverPhoto =
        !matchingFolder.cover_photo_url && mergedIds.length > 0
          ? photos.find((p) => p.id === mergedIds[0])
          : null;
      await base44.entities.Folder.update(matchingFolder.id, {
        photo_ids: mergedIds,
        ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }),
      });
    } else {
      const coverPhoto = photos.find((p) => p.id === folder.photo_ids[0]);
      await base44.entities.Folder.create({
        name: folder.name,
        description: "",
        photo_ids: folder.photo_ids,
        cover_photo_url: coverPhoto?.file_url || "",
      });
    }
  });

  await runConcurrent(folderTasks, 3);
  await cleanupEmptyFolders(allPhotoIds);

  const totalSaved = foldersToSave.reduce((sum, f) => sum + f.photo_ids.length, 0);
  const missed = photosToOrganize.length - totalSaved;

  return {
    ok: true,
    foldersSaved: foldersToSave.length,
    totalSaved,
    totalToOrganize: photosToOrganize.length,
    missed,
  };
}
