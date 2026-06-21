import { base44 } from "@/api/base44Client";
import { reanalyzeWeakPhotos } from "@/lib/media-analysis";
import { isWeakMetadata } from "@/lib/media-tags";
import {
  buildFolderOptions,
  buildLabelPrompt,
  buildMergePrompt,
  photoDataForOrganize,
} from "@/lib/media-organize";

const CHUNK_SIZE = 40;
const CONCURRENCY = 4;
const MERGE_CHUNK = 25;
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

async function labelChunk(chunk, existingFolderNames, customInstructions) {
  const photoData = chunk.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions(existingFolderNames);

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildLabelPrompt({ photoData, folderOptions, customInstructions }),
    response_json_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              folder: { type: "string" },
            },
          },
        },
      },
    },
  });

  return result.labels || [];
}

async function mergeGroupBatch(groups, existingFolderNames, customInstructions, validPhotoIds) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildMergePrompt({ groups, existingFolderNames, customInstructions }),
    response_json_schema: {
      type: "object",
      properties: {
        folders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              ids: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  });

  return (result.folders || []).map((f) => ({
    name: f.name,
    ids: filterValidIds(f.ids, validPhotoIds),
  }));
}

async function consolidateGroups(initialGroups, existingFolderNames, customInstructions, validPhotoIds, onProgress) {
  let groups = initialGroups.map((g) => ({
    name: g.name,
    ids: filterValidIds(g.ids, validPhotoIds),
  })).filter((g) => g.ids.length > 0);

  let pass = 1;

  while (groups.length > MERGE_CHUNK) {
    onProgress(`Phase 2 (pass ${pass}): merging ${groups.length} groups…`);
    const batches = [];
    for (let i = 0; i < groups.length; i += MERGE_CHUNK) {
      batches.push(groups.slice(i, i + MERGE_CHUNK));
    }
    const batchResults = await runConcurrent(
      batches.map((batch) => () => mergeGroupBatch(batch, existingFolderNames, customInstructions, validPhotoIds)),
      CONCURRENCY
    );
    const merged = new Map();
    for (const batch of batchResults) {
      for (const { name, ids } of batch) {
        const key = name.toLowerCase().trim();
        if (!merged.has(key)) merged.set(key, { name, ids: new Set(ids) });
        else ids.forEach((id) => merged.get(key).ids.add(id));
      }
    }
    groups = Array.from(merged.values())
      .map((g) => ({ name: g.name, ids: filterValidIds([...g.ids], validPhotoIds) }))
      .filter((g) => g.ids.length > 0);
    pass++;
  }

  onProgress(`Phase 2: final consolidation of ${groups.length} groups…`);
  const finalGroups = await mergeGroupBatch(groups, existingFolderNames, customInstructions, validPhotoIds);

  const finalMap = new Map();
  for (const { name, ids } of finalGroups) {
    const key = name.toLowerCase().trim();
    if (!finalMap.has(key)) finalMap.set(key, { name, ids: new Set(ids) });
    else ids.forEach((id) => finalMap.get(key).ids.add(id));
  }

  return Array.from(finalMap.values())
    .map((g) => ({
      name: g.name,
      photo_ids: filterValidIds([...g.ids], validPhotoIds),
    }))
    .filter((f) => f.photo_ids.length > 0);
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
  customInstructions,
  onProgress,
}) {
  const existingFolders = await base44.entities.Folder.list();
  const organizedPhotoIds = new Set(existingFolders.flatMap((f) => f.photo_ids || []));
  const existingFolderNames = existingFolders.map((f) => f.name);

  let photosToOrganize = includeOrganized
    ? photos
    : photos.filter((p) => !organizedPhotoIds.has(p.id));

  if (photosToOrganize.length < 2) {
    return {
      ok: false,
      reason:
        photosToOrganize.length === 0
          ? "All photos are already in folders. Check 'Re-organize everything' to re-sort."
          : "Only 1 loose photo found — need at least 2 to organize.",
    };
  }

  const validPhotoIds = new Set(photosToOrganize.map((p) => p.id));
  const allPhotoIds = new Set(photos.map((p) => p.id));

  if (includeOrganized && existingFolders.length > 0) {
    onProgress(`Clearing ${existingFolders.length} existing folders for re-organization…`);
    await runConcurrent(
      existingFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
      5
    );
  }

  if (sharpenTags) {
    const weakInBatch = photosToOrganize.filter(isWeakMetadata).length;
    if (weakInBatch > 0) {
      onProgress(`Sharpening visual tags for ${weakInBatch} item${weakInBatch !== 1 ? "s" : ""}…`);
      photosToOrganize = await reanalyzeWeakPhotos(photosToOrganize, { onProgress });
    }
  }

  const chunks = [];
  for (let i = 0; i < photosToOrganize.length; i += CHUNK_SIZE) {
    chunks.push(photosToOrganize.slice(i, i + CHUNK_SIZE));
  }

  const totalChunks = chunks.length;
  let completedChunks = 0;
  onProgress(
    `Phase 1: labelling ${photosToOrganize.length} item${photosToOrganize.length !== 1 ? "s" : ""} (${totalChunks} batch${totalChunks !== 1 ? "es" : ""})…`
  );

  const labelTasks = chunks.map((chunk) => async () => {
    const labels = await labelChunk(
      chunk,
      includeOrganized ? [] : existingFolderNames,
      customInstructions
    );
    completedChunks++;
    onProgress(`Phase 1: ${completedChunks}/${totalChunks} batches done…`);
    return labels.filter((l) => validPhotoIds.has(l.id));
  });

  const labelResults = await runConcurrent(labelTasks, CONCURRENCY);
  const allLabels = labelResults.flat();

  const labelledIds = new Set(allLabels.map((l) => l.id));
  for (const photo of photosToOrganize) {
    if (!labelledIds.has(photo.id)) {
      allLabels.push({ id: photo.id, folder: MISC_FOLDER });
    }
  }

  const groupMap = new Map();
  for (const { id, folder } of allLabels) {
    if (!validPhotoIds.has(id)) continue;
    const display = (folder || MISC_FOLDER).trim();
    const key = display.toLowerCase();
    if (!groupMap.has(key)) groupMap.set(key, { name: display, ids: new Set() });
    groupMap.get(key).ids.add(id);
  }
  const initialGroups = Array.from(groupMap.values()).map((g) => ({
    name: g.name,
    ids: [...g.ids],
  }));

  let finalFolders = await consolidateGroups(
    initialGroups,
    includeOrganized ? [] : existingFolderNames,
    customInstructions,
    validPhotoIds,
    onProgress
  );

  finalFolders = assignRemainingPhotos(finalFolders, photosToOrganize, validPhotoIds);

  onProgress(`Saving ${finalFolders.length} folders…`);

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

  await runConcurrent(folderTasks, 5);
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
