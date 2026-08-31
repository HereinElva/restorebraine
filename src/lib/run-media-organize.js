import { invokeLLMWithRetry } from "@/lib/invoke-llm-retry";
import {
  assignFolderLocally,
  buildFolderOptions,
  buildLabelPrompt,
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
} from "@/lib/folder-membership";
import {
  recordBatchFolderMembership,
} from "@/lib/folder-membership-cache";

const CHUNK_SIZE = 15;
const SAVE_BATCH_SIZE = 20;
const LLM_DELAY_MS = 1500;
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
    onProgress?.(`Grouping Batch ${i + 1}/${chunks.length}…`);

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

  // When UI shows no folders, skip Folder.list — it often hangs and blocks organize.
  let apiFolders = [];
  if (includeOrganized || !uiShowsNoFolders) {
    onProgress?.("Checking folders…");
    apiFolders = sanitizeFoldersLocally(
      await listAllFoldersSafe({ email: userEmail, timeoutMs: 8000 }),
      photos,
      allPhotoIds,
    );
  }

  const liveFolderSource = uiShowsNoFolders ? [] : uiFolders.length ? uiFolders : apiFolders;
  const existingFolderNames = liveFolderSource.map((f) => f.name);

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

  const batchPhotos = photosToOrganize.slice(0, SAVE_BATCH_SIZE);
  const remainingLoose = photosToOrganize.length - batchPhotos.length;

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
    remainingLoose > 0
      ? `Sorting ${batchPhotos.length} of ${photosToOrganize.length} loose items…`
      : `Sorting ${batchPhotos.length} loose item${batchPhotos.length !== 1 ? "s" : ""}…`,
  );

  const validPhotoIds = new Set(batchPhotos.map((p) => normalizePhotoId(p.id)));
  const folderNamesForLabel = includeOrganized ? [] : existingFolderNames;

  const allLabels = await buildLabelsFromDescriptions(
    batchPhotos,
    folderNamesForLabel,
    customInstructions,
    validPhotoIds,
    onProgress
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

  let afterFolders = saveResult.folders;
  const failedNormIds = new Set((saveResult.failedPhotoIds || []).map(normalizePhotoId));

  onProgress?.("Done");

  const savedApiFolders = afterFolders;

  const missedPhotos = batchPhotos.filter(
    (p) =>
      failedNormIds.has(normalizePhotoId(p.id)) ||
      getUnorganizedPhotos([p], afterFolders).length > 0,
  );
  const actuallySaved = batchPhotos.length - missedPhotos.length;
  const totalRemainingLoose = remainingLoose + missedPhotos.length;

  if (actuallySaved === 0 && batchPhotos.length > 0) {
    return {
      ok: false,
      reason: "Organize could not save photos into folders. Pull down to refresh, then try again.",
    };
  }

  if (userEmail && actuallySaved > 0) {
    const entries = [];
    for (const photo of batchPhotos) {
      if (missedPhotos.some((p) => normalizePhotoId(p.id) === normalizePhotoId(photo.id))) continue;
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
    missed: missedPhotos.length,
    remainingLoose: totalRemainingLoose,
    partial: totalRemainingLoose > 0,
    afterFolders,
    apiFolders: savedApiFolders,
    photosToOrganize: batchPhotos,
    labelByPhotoNormId,
  };
}
