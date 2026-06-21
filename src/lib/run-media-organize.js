import { base44 } from "@/api/base44Client";
import { invokeLLMWithRetry } from "@/lib/invoke-llm-retry";
import {
  assignFolderLocally,
  buildFolderOptions,
  buildLabelPrompt,
  parseCustomFolderHints,
  photoDataForOrganize,
} from "@/lib/media-organize";
import {
  getOrganizedPhotoIds,
  getUnorganizedPhotos,
  normalizePhotoId,
  toStoredPhotoIds,
} from "@/lib/gallery-organize-snapshot";
import { assignLoosePhotosToFolders, mergeApiFoldersWithLocal } from "@/lib/folder-membership";

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

  onProgress?.("Saving folders…");

  const liveFolders = includeOrganized ? [] : existingFolders;
  const labelByPhotoNormId = new Map(allLabels.map((l) => [l.id, l.folder]));
  const nameList = folderNamesForLabel.length ? folderNamesForLabel : existingFolderNames;

  let afterFolders = await assignLoosePhotosToFolders({
    photosToAssign: photosToOrganize,
    labelByPhotoNormId,
    liveFolders,
    existingFolderNames: nameList,
    includeOrganized,
    onProgress,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    let organizedAfter = getOrganizedPhotoIds(afterFolders);
    let missedPhotos = photosToOrganize.filter(
      (p) => !organizedAfter.has(normalizePhotoId(p.id)),
    );

    if (missedPhotos.length === 0) break;

    onProgress?.(
      attempt === 0
        ? `Confirming ${missedPhotos.length} remaining…`
        : `Retrying ${missedPhotos.length}… (${attempt + 1}/3)`,
    );

    const apiFolders = await base44.entities.Folder.list();
    afterFolders = await assignLoosePhotosToFolders({
      photosToAssign: missedPhotos,
      labelByPhotoNormId,
      liveFolders: apiFolders.length ? apiFolders : afterFolders,
      existingFolderNames: (apiFolders.length ? apiFolders : afterFolders).map((f) => f.name),
      includeOrganized: false,
      onProgress,
    });
  }

  const apiFolders = await base44.entities.Folder.list();
  afterFolders = mergeApiFoldersWithLocal(apiFolders, afterFolders);

  const organizedAfter = getOrganizedPhotoIds(afterFolders);
  const actuallySaved = photosToOrganize.filter((p) =>
    organizedAfter.has(normalizePhotoId(p.id)),
  ).length;
  const missed = photosToOrganize.length - actuallySaved;

  await cleanupEmptyFolders(allPhotoIds);

  if (actuallySaved === 0 && photosToOrganize.length > 0) {
    return {
      ok: false,
      reason: "Folders could not be saved. Pull down to refresh and try Organize again.",
    };
  }

  return {
    ok: true,
    foldersSaved: new Set(allLabels.map((l) => l.folder)).size,
    totalSaved: actuallySaved,
    totalToOrganize: photosToOrganize.length,
    missed,
    afterFolders,
    photosToOrganize,
    labelByPhotoNormId,
  };
}
