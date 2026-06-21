import { base44 } from "@/api/base44Client";
import { invokeLLMWithRetry } from "@/lib/invoke-llm-retry";
import {
  assignFolderLocally,
  buildFolderOptions,
  buildLabelPrompt,
  mergeFolderGroupsLocally,
  normalizeFolderName,
  parseCustomFolderHints,
  photoDataForOrganize,
} from "@/lib/media-organize";
import {
  getOrganizedPhotoIds,
  getUnorganizedPhotos,
  mergeStoredPhotoIds,
  normalizePhotoId,
  toStoredPhotoIds,
} from "@/lib/gallery-organize-snapshot";

const CHUNK_SIZE = 15;
const LLM_DELAY_MS = 1500;
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

function findExistingFolder(liveFolders, folderName, existingFolderNames) {
  const targetKey = normalizeFolderName(folderName, existingFolderNames).toLowerCase();
  return liveFolders.find(
    (f) => normalizeFolderName(f.name, existingFolderNames).toLowerCase() === targetKey,
  );
}

function coverPhotoForIds(storedIds, photos, fallbackUrl = "") {
  if (!storedIds.length) return fallbackUrl;
  const photo = photos.find(
    (p) => normalizePhotoId(p.id) === normalizePhotoId(storedIds[0]),
  );
  return photo?.file_url || fallbackUrl;
}

async function sanitizeFolderMembership(folders, photos, allPhotoIds) {
  const tasks = folders.map((folder) => async () => {
    const normalized = (folder.photo_ids || [])
      .map(normalizePhotoId)
      .filter((id) => allPhotoIds.has(id));
    const cleaned = toStoredPhotoIds(normalized, photos);
    const prevNorm = (folder.photo_ids || []).map(normalizePhotoId).sort().join(',');
    const nextNorm = cleaned.map(normalizePhotoId).sort().join(',');
    if (prevNorm !== nextNorm) {
      await base44.entities.Folder.update(folder.id, { photo_ids: cleaned });
      return { ...folder, photo_ids: cleaned };
    }
    return folder;
  });
  return runConcurrent(tasks, 5);
}

async function labelChunkWithAI(chunk, existingFolderNames, customInstructions, customFolderHints) {
  const photoData = chunk.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions(existingFolderNames, customFolderHints);

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
    { maxRetries: 1, baseDelayMs: 2500, timeoutMs: 50000 }
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
  validPhotoIds,
  onProgress
) {
  const customFolderHints = parseCustomFolderHints(customInstructions);
  const chunks = [];
  const chunkSize = photosToOrganize.length <= 15 ? photosToOrganize.length : CHUNK_SIZE;
  for (let i = 0; i < photosToOrganize.length; i += chunkSize) {
    chunks.push(photosToOrganize.slice(i, i + chunkSize));
  }

  const allLabels = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (i > 0) await sleep(LLM_DELAY_MS);
    onProgress?.(`Grouping batch ${i + 1}/${chunks.length}…`);

    try {
      const labels = await labelChunkWithAI(
        chunk,
        existingFolderNames,
        customInstructions,
        customFolderHints
      );
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

async function saveFolderGroups({
  foldersToSave,
  photos,
  allPhotoIds,
  includeOrganized,
  existingFolderNames,
  liveFolders,
  onProgress,
}) {
  let folders = [...liveFolders];
  const folderNames = () => folders.map((f) => f.name);

  for (let i = 0; i < foldersToSave.length; i++) {
    const folder = foldersToSave[i];
    onProgress?.(`Saving folders… (${i + 1}/${foldersToSave.length})`);

    const storedNewIds = toStoredPhotoIds(folder.photo_ids, photos);
    if (storedNewIds.length === 0) continue;

    const displayName = normalizeFolderName(folder.name, existingFolderNames);
    const matchingFolder = findExistingFolder(folders, displayName, folderNames());

    if (matchingFolder && !includeOrganized) {
      const mergedIds = mergeStoredPhotoIds(matchingFolder.photo_ids, storedNewIds, photos);
      const coverPhotoUrl = coverPhotoForIds(
        mergedIds,
        photos,
        matchingFolder.cover_photo_url || "",
      );
      await base44.entities.Folder.update(matchingFolder.id, {
        photo_ids: mergedIds,
        ...(!matchingFolder.cover_photo_url && coverPhotoUrl
          ? { cover_photo_url: coverPhotoUrl }
          : {}),
      });
      folders = folders.map((f) =>
        f.id === matchingFolder.id ? { ...f, photo_ids: mergedIds, name: f.name } : f,
      );
    } else if (matchingFolder && includeOrganized) {
      const coverPhotoUrl = coverPhotoForIds(storedNewIds, photos, matchingFolder.cover_photo_url || "");
      await base44.entities.Folder.update(matchingFolder.id, {
        photo_ids: storedNewIds,
        cover_photo_url: coverPhotoUrl,
      });
      folders = folders.map((f) =>
        f.id === matchingFolder.id ? { ...f, photo_ids: storedNewIds } : f,
      );
    } else {
      const coverPhotoUrl = coverPhotoForIds(storedNewIds, photos, "");
      const created = await base44.entities.Folder.create({
        name: displayName,
        description: "",
        photo_ids: storedNewIds,
        cover_photo_url: coverPhotoUrl,
      });
      folders.push(created);
    }
  }

  return folders;
}

async function saveMissedPhotos({
  missedPhotos,
  allLabels,
  photos,
  existingFolderNames,
  onProgress,
}) {
  if (missedPhotos.length === 0) return;

  onProgress?.(`Saving ${missedPhotos.length} remaining…`);

  let folders = await base44.entities.Folder.list();

  for (const photo of missedPhotos) {
    const norm = normalizePhotoId(photo.id);
    const label = allLabels.find((l) => l.id === norm);
    const folderName = normalizeFolderName(label?.folder || MISC_FOLDER, existingFolderNames);
    let target = findExistingFolder(folders, folderName, folders.map((f) => f.name));
    const storedId = toStoredPhotoIds([norm], photos);
    if (storedId.length === 0) continue;

    if (target) {
      const mergedIds = mergeStoredPhotoIds(target.photo_ids, storedId, photos);
      await base44.entities.Folder.update(target.id, { photo_ids: mergedIds });
      folders = folders.map((f) =>
        f.id === target.id ? { ...f, photo_ids: mergedIds } : f,
      );
    } else {
      const created = await base44.entities.Folder.create({
        name: folderName,
        description: "",
        photo_ids: storedId,
        cover_photo_url: coverPhotoForIds(storedId, photos, ""),
      });
      folders.push(created);
    }
  }
}

export async function runMediaOrganize({
  photos,
  folders: foldersSnapshot,
  includeOrganized,
  customInstructions,
  onProgress,
}) {
  onProgress?.("Preparing…");

  const allPhotoIds = new Set(photos.map((p) => normalizePhotoId(p.id)).filter(Boolean));

  let existingFolders = await base44.entities.Folder.list();
  existingFolders = await sanitizeFolderMembership(existingFolders, photos, allPhotoIds);
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
    onProgress?.("Clearing folders…");
    await runConcurrent(
      existingFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
      5
    );
    existingFolders = [];
  }

  onProgress?.(`Sorting ${photosToOrganize.length} loose item${photosToOrganize.length !== 1 ? "s" : ""}…`);

  const folderNamesForLabel = includeOrganized ? [] : existingFolderNames;

  const allLabels = await buildLabelsFromDescriptions(
    photosToOrganize,
    folderNamesForLabel,
    customInstructions,
    validPhotoIds,
    onProgress
  );

  const initialGroups = buildGroupsFromLabels(allLabels, folderNamesForLabel, validPhotoIds);

  let finalFolders = mergeFolderGroupsLocally(initialGroups, folderNamesForLabel);
  finalFolders = assignRemainingPhotos(finalFolders, photosToOrganize, validPhotoIds);

  onProgress?.("Saving folders…");

  const liveFolders = includeOrganized ? [] : existingFolders;

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

  await saveFolderGroups({
    foldersToSave,
    photos,
    allPhotoIds,
    includeOrganized,
    existingFolderNames: folderNamesForLabel.length ? folderNamesForLabel : existingFolderNames,
    liveFolders,
    onProgress,
  });

  let afterFolders = await base44.entities.Folder.list();
  let organizedAfter = getOrganizedPhotoIds(afterFolders);
  let missedPhotos = photosToOrganize.filter(
    (p) => !organizedAfter.has(normalizePhotoId(p.id)),
  );

  if (missedPhotos.length > 0) {
    await saveMissedPhotos({
      missedPhotos,
      allLabels,
      photos,
      existingFolderNames: afterFolders.map((f) => f.name),
      onProgress,
    });
    afterFolders = await base44.entities.Folder.list();
    organizedAfter = getOrganizedPhotoIds(afterFolders);
    missedPhotos = photosToOrganize.filter(
      (p) => !organizedAfter.has(normalizePhotoId(p.id)),
    );
  }

  await cleanupEmptyFolders(allPhotoIds);

  const actuallySaved = photosToOrganize.filter((p) =>
    organizedAfter.has(normalizePhotoId(p.id)),
  ).length;
  const missed = photosToOrganize.length - actuallySaved;

  if (actuallySaved === 0 && photosToOrganize.length > 0) {
    return {
      ok: false,
      reason: "Folders could not be saved. Pull down to refresh and try Organize again.",
    };
  }

  return {
    ok: true,
    foldersSaved: foldersToSave.length,
    totalSaved: actuallySaved,
    totalToOrganize: photosToOrganize.length,
    missed,
  };
}
