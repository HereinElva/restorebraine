import { base44 } from "@/api/base44Client";
import { reanalyzeWeakPhotos } from "@/lib/media-analysis";
import { isWeakMetadata } from "@/lib/media-tags";
import { invokeLLMWithRetry } from "@/lib/invoke-llm-retry";
import {
  assignFolderLocally,
  buildFolderOptions,
  buildLabelPrompt,
  mergeFolderGroupsLocally,
  normalizeFolderName,
  photoDataForOrganize,
} from "@/lib/media-organize";
import {
  getOrganizedPhotoIds,
  getUnorganizedPhotos,
  normalizePhotoId,
} from "@/lib/gallery-organize-snapshot";

const CHUNK_SIZE = 25;
const LLM_DELAY_MS = 4500;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filterValidIds(ids, validPhotoIds) {
  return (ids || []).map(normalizePhotoId).filter((id) => validPhotoIds.has(id));
}

async function sanitizeFolderMembership(folders, allPhotoIds) {
  const tasks = folders.map((folder) => async () => {
    const cleaned = [
      ...new Set((folder.photo_ids || []).map(normalizePhotoId).filter((id) => allPhotoIds.has(id))),
    ];
    if (cleaned.length !== (folder.photo_ids || []).length) {
      await base44.entities.Folder.update(folder.id, { photo_ids: cleaned });
      return { ...folder, photo_ids: cleaned };
    }
    return folder;
  });
  return runConcurrent(tasks, 5);
}

async function labelChunkWithAI(chunk, existingFolderNames, customInstructions) {
  const photoData = chunk.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions(existingFolderNames);

  const result = await invokeLLMWithRetry(
    {
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
    },
    { maxRetries: 8, baseDelayMs: 6000 }
  );

  return result.labels || [];
}

function labelChunkLocally(chunk) {
  return chunk.map((photo) => ({
    id: normalizePhotoId(photo.id),
    folder: assignFolderLocally(photo),
  }));
}

async function buildLabelsFromDescriptions(
  photosToOrganize,
  existingFolderNames,
  customInstructions,
  validPhotoIds
) {
  const chunks = [];
  for (let i = 0; i < photosToOrganize.length; i += CHUNK_SIZE) {
    chunks.push(photosToOrganize.slice(i, i + CHUNK_SIZE));
  }

  const allLabels = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (i > 0) await sleep(LLM_DELAY_MS);

    try {
      const labels = await labelChunkWithAI(chunk, existingFolderNames, customInstructions);
      for (const label of labels) {
        const id = normalizePhotoId(label.id);
        if (validPhotoIds.has(id)) {
          allLabels.push({ id, folder: label.folder || MISC_FOLDER });
        }
      }
    } catch (error) {
      console.warn("AI label batch failed, using local fallback:", error);
      allLabels.push(...labelChunkLocally(chunk));
    }
  }

  const labelledIds = new Set(allLabels.map((l) => l.id));
  for (const photo of photosToOrganize) {
    const id = normalizePhotoId(photo.id);
    if (!labelledIds.has(id)) {
      allLabels.push({ id, folder: assignFolderLocally(photo) });
    }
  }

  return allLabels;
}

function buildGroupsFromLabels(allLabels, existingFolderNames, validPhotoIds) {
  const groupMap = new Map();
  for (const { id, folder } of allLabels) {
    if (!validPhotoIds.has(id)) continue;
    const display = normalizeFolderName(folder || MISC_FOLDER, existingFolderNames);
    const key = display.toLowerCase();
    if (!groupMap.has(key)) groupMap.set(key, { name: display, ids: new Set() });
    groupMap.get(key).ids.add(id);
  }
  return Array.from(groupMap.values()).map((g) => ({
    name: g.name,
    ids: [...g.ids],
  }));
}

function assignRemainingPhotos(folders, photosToOrganize, validPhotoIds) {
  const assigned = new Set(folders.flatMap((f) => f.photo_ids));
  const remaining = photosToOrganize
    .map((p) => normalizePhotoId(p.id))
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
    const validIds = (f.photo_ids || []).map(normalizePhotoId).filter((id) => allPhotoIds.has(id));
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
  folders: foldersSnapshot,
  includeOrganized,
  sharpenTags,
  customInstructions,
}) {
  const allPhotoIds = new Set(photos.map((p) => normalizePhotoId(p.id)).filter(Boolean));

  let existingFolders = await base44.entities.Folder.list();
  existingFolders = await sanitizeFolderMembership(existingFolders, allPhotoIds);
  await cleanupEmptyFolders(allPhotoIds);
  existingFolders = await base44.entities.Folder.list();

  const snapshotFolders = foldersSnapshot?.length ? foldersSnapshot : existingFolders;
  const existingFolderNames = existingFolders.map((f) => f.name);

  let photosToOrganize = includeOrganized
    ? photos
    : getUnorganizedPhotos(photos, snapshotFolders);

  if (photosToOrganize.length === 0 && !includeOrganized) {
    const apiOrganized = getOrganizedPhotoIds(existingFolders);
    photosToOrganize = photos.filter((p) => !apiOrganized.has(normalizePhotoId(p.id)));
  }

  if (photosToOrganize.length === 0) {
    return {
      ok: false,
      reason: includeOrganized
        ? "No photos to organize."
        : "No loose photos found in your gallery. Photos already in folders are skipped — check \"Re-organize everything\" to re-sort all media.",
    };
  }

  const validPhotoIds = new Set(photosToOrganize.map((p) => normalizePhotoId(p.id)));

  if (includeOrganized && existingFolders.length > 0) {
    await runConcurrent(
      existingFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
      5
    );
    existingFolders = [];
  }

  if (sharpenTags) {
    const weakInBatch = photosToOrganize.filter(isWeakMetadata).length;
    if (weakInBatch > 0) {
      photosToOrganize = await reanalyzeWeakPhotos(photosToOrganize, {});
    }
  }

  const folderNamesForLabel = includeOrganized ? [] : existingFolderNames;

  const allLabels = await buildLabelsFromDescriptions(
    photosToOrganize,
    folderNamesForLabel,
    customInstructions,
    validPhotoIds
  );

  const initialGroups = buildGroupsFromLabels(allLabels, folderNamesForLabel, validPhotoIds);

  let finalFolders = mergeFolderGroupsLocally(initialGroups, folderNamesForLabel);
  finalFolders = assignRemainingPhotos(finalFolders, photosToOrganize, validPhotoIds);

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
    .map((p) => normalizePhotoId(p.id))
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
    }
  }

  const folderTasks = foldersToSave.map((folder) => async () => {
    const matchingFolder = currentFolders.find(
      (f) => f.name.toLowerCase() === folder.name.toLowerCase()
    );

    if (matchingFolder && !includeOrganized) {
      const mergedIds = [
        ...new Set([
          ...filterValidIds(matchingFolder.photo_ids, allPhotoIds),
          ...folder.photo_ids,
        ]),
      ];
      const coverPhoto =
        !matchingFolder.cover_photo_url && mergedIds.length > 0
          ? photos.find((p) => normalizePhotoId(p.id) === mergedIds[0])
          : null;
      await base44.entities.Folder.update(matchingFolder.id, {
        photo_ids: mergedIds,
        ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }),
      });
    } else if (matchingFolder && includeOrganized) {
      await base44.entities.Folder.update(matchingFolder.id, {
        photo_ids: folder.photo_ids,
        cover_photo_url:
          photos.find((p) => normalizePhotoId(p.id) === folder.photo_ids[0])?.file_url ||
          matchingFolder.cover_photo_url ||
          "",
      });
    } else {
      const coverPhoto = photos.find((p) => normalizePhotoId(p.id) === folder.photo_ids[0]);
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
