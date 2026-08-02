import { invokeLLMWithRetry } from "@/lib/invoke-llm-retry";
import {
  assignFolderToOrganizeBatch,
  buildFolderOptions,
  buildLabelPrompt,
  consolidateOrganizeLabels,
  getOrganizeFolderNames,
  ORGANIZE_BATCH_FOLDER_COUNT,
  parseCustomFolderHints,
  photoDataForOrganize,
} from "@/lib/media-organize";
import {
  getUnorganizedPhotos,
  loosePhotosForOrganize,
  normalizePhotoId,
  toStoredPhotoIds,
} from "@/lib/gallery-organize-snapshot";
import {
  assignLoosePhotosByFolder,
  deleteFoldersWithTimeout,
  listAllFoldersSafe,
  reconcileOrganizeBatch,
} from "@/lib/folder-membership";
import {
  recordBatchFolderMembership,
} from "@/lib/folder-membership-cache";

const CHUNK_SIZE = 40;
const LLM_DELAY_MS = 800;
const LOCAL_LABEL_THRESHOLD = 20;
const MISC_FOLDER = "Miscellaneous";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFoldersLocally(folders, photos, allPhotoIds) {
  return (folders || []).map((folder) => {
    const normalized = (folder.photo_ids || [])
      .map(normalizePhotoId)
      .filter((id) => allPhotoIds.has(id));
    return {
      ...folder,
      photo_ids: toStoredPhotoIds(normalized, photos),
    };
  });
}

async function labelChunkWithAI(chunk, folderNamesForLabel, customInstructions, customFolderHints) {
  const photoData = chunk.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions(folderNamesForLabel, customFolderHints);

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

function labelAllLocally(photosToOrganize, folderNamesForLabel) {
  return photosToOrganize.map((photo) => ({
    id: normalizePhotoId(photo.id),
    folder: assignFolderToOrganizeBatch(photo, folderNamesForLabel),
  }));
}

function labelChunkLocally(chunk, folderNamesForLabel) {
  return chunk.map((photo) => ({
    id: normalizePhotoId(photo.id),
    folder: assignFolderToOrganizeBatch(photo, folderNamesForLabel),
  }));
}

async function buildLabelsFromDescriptions(
  photosToOrganize,
  folderNamesForLabel,
  customInstructions,
  validPhotoIds,
  onProgress
) {
  if (photosToOrganize.length >= LOCAL_LABEL_THRESHOLD) {
    onProgress?.(`Grouping ${photosToOrganize.length} items…`);
    return labelAllLocally(photosToOrganize, folderNamesForLabel);
  }

  const customFolderHints = parseCustomFolderHints(customInstructions);
  const chunks = [];
  const chunkSize = photosToOrganize.length <= CHUNK_SIZE ? photosToOrganize.length : CHUNK_SIZE;
  for (let i = 0; i < photosToOrganize.length; i += chunkSize) {
    chunks.push(photosToOrganize.slice(i, i + chunkSize));
  }

  const allLabels = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (i > 0) await sleep(LLM_DELAY_MS);
    onProgress?.(`Grouping Batch ${i + 1}/${chunks.length}…`);

    try {
      const labels = await labelChunkWithAI(
        chunk,
        folderNamesForLabel,
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
      allLabels.push(...labelChunkLocally(chunk, folderNamesForLabel));
    }
  }

  const labelledIds = new Set(allLabels.map((l) => l.id));
  for (const photo of photosToOrganize) {
    const id = normalizePhotoId(photo.id);
    if (!labelledIds.has(id)) {
      allLabels.push({
        id,
        folder: assignFolderToOrganizeBatch(photo, folderNamesForLabel),
      });
    }
  }

  return allLabels;
}

export async function runMediaOrganize({
  photos,
  folders: foldersSnapshot,
  includeOrganized,
  customInstructions,
  onProgress,
  onPartialSave,
  userEmail,
}) {
  onProgress?.("Preparing…");

  const allPhotoIds = new Set(photos.map((p) => normalizePhotoId(p.id)).filter(Boolean));
  const uiFolders = foldersSnapshot ?? [];
  const uiShowsNoFolders = uiFolders.length === 0;

  let apiFolders = [];
  if (includeOrganized || !uiShowsNoFolders) {
    onProgress?.("Checking folders…");
    apiFolders = sanitizeFoldersLocally(
      await listAllFoldersSafe({ timeoutMs: 8000 }),
      photos,
      allPhotoIds,
    );
  }

  const liveFolderSource = uiShowsNoFolders ? [] : uiFolders.length ? uiFolders : apiFolders;
  const existingFolderNames = liveFolderSource.map((f) => f.name);
  const folderNamesForLabel = getOrganizeFolderNames(existingFolderNames, includeOrganized);
  const maxFolderCount = Math.max(
    ORGANIZE_BATCH_FOLDER_COUNT,
    includeOrganized ? ORGANIZE_BATCH_FOLDER_COUNT : folderNamesForLabel.length,
  );

  const photosToOrganize = includeOrganized
    ? photos
    : loosePhotosForOrganize(photos, uiFolders);

  if (photosToOrganize.length === 0) {
    return {
      ok: false,
      reason: includeOrganized
        ? "No photos to organize."
        : "No loose photos found in your gallery. Photos already in folders are skipped — check \"Re-organize everything\" to re-sort all media.",
    };
  }

  const batchPhotos = photosToOrganize;

  if (includeOrganized && apiFolders.length > 0) {
    const confirmed = typeof window !== 'undefined' && window.confirm(
      `Delete all ${apiFolders.length} existing folders and re-sort every photo? Your photos will not be deleted.`,
    );
    if (!confirmed) {
      return { ok: false, reason: 'Re-organize cancelled.' };
    }
    onProgress?.("Clearing folders…");
    await deleteFoldersWithTimeout(apiFolders.map((f) => f.id));
    apiFolders = [];
  }

  onProgress?.(
    batchPhotos.length > 1
      ? `Sorting ${batchPhotos.length} loose items into up to ${maxFolderCount} folders…`
      : `Sorting ${batchPhotos.length} loose item…`,
  );

  const validPhotoIds = new Set(batchPhotos.map((p) => normalizePhotoId(p.id)));

  const rawLabels = await buildLabelsFromDescriptions(
    batchPhotos,
    folderNamesForLabel,
    customInstructions,
    validPhotoIds,
    onProgress
  );

  const allLabels = consolidateOrganizeLabels(
    rawLabels,
    batchPhotos,
    folderNamesForLabel,
    maxFolderCount,
  );

  onProgress?.("Saving folders…");

  const liveFolders = includeOrganized ? [] : liveFolderSource;
  const labelByPhotoNormId = new Map(allLabels.map((l) => [l.id, l.folder]));

  const saveResult = await assignLoosePhotosByFolder({
    photosToAssign: batchPhotos,
    labelByPhotoNormId,
    liveFolders,
    onProgress,
    onPartialSave,
    userEmail,
  });

  onProgress?.("Verifying saves…");

  const reconcileResult = await reconcileOrganizeBatch({
    batchPhotos,
    afterFolders: saveResult.folders,
    labelByPhotoNormId,
    onProgress,
    userEmail,
  });

  const afterFolders = reconcileResult.folders;
  const actuallySaved = reconcileResult.totalSaved;
  const missed = reconcileResult.missed;
  const totalRemainingLoose = getUnorganizedPhotos(photos, afterFolders).length;

  onProgress?.("Done");

  if (actuallySaved === 0 && batchPhotos.length > 0) {
    return {
      ok: false,
      reason: "Organize could not save photos into folders. Pull down to refresh, then try again.",
    };
  }

  if (userEmail && actuallySaved > 0) {
    const entries = [];
    for (const photo of batchPhotos) {
      if (getUnorganizedPhotos([photo], afterFolders).length > 0) continue;
      const folder = afterFolders.find((f) =>
        (f.photo_ids || []).some((id) => normalizePhotoId(id) === normalizePhotoId(photo.id)),
      );
      if (folder) entries.push({ photoId: photo.id, folderId: folder.id });
    }
    if (entries.length) void recordBatchFolderMembership(userEmail, entries);
  }

  return {
    ok: true,
    foldersSaved: new Set(allLabels.map((l) => l.folder)).size,
    totalSaved: actuallySaved,
    totalToOrganize: batchPhotos.length,
    missed,
    remainingLoose: totalRemainingLoose,
    partial: totalRemainingLoose > 0,
    afterFolders,
    apiFolders: reconcileResult.apiFolders || afterFolders,
    photosToOrganize: batchPhotos,
    labelByPhotoNormId,
  };
}
