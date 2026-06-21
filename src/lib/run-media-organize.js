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
import {
  assignLoosePhotosToFolders,
  listAllFolders,
  mergeApiFoldersWithLocal,
  reconcileOrganizeBatch,
} from "@/lib/folder-membership";

const CHUNK_SIZE = 15;
const LLM_DELAY_MS = 1500;
const MISC_FOLDER = "Miscellaneous";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clean folder membership in memory only — do not write to API before organize saves. */
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

export async function runMediaOrganize({
  photos,
  folders: foldersSnapshot,
  includeOrganized,
  customInstructions,
  onProgress,
}) {
  onProgress?.("Preparing…");

  const allPhotoIds = new Set(photos.map((p) => normalizePhotoId(p.id)).filter(Boolean));

  let existingFolders = await listAllFolders();
  existingFolders = sanitizeFoldersLocally(existingFolders, photos, allPhotoIds);

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
    for (const folder of existingFolders) {
      await base44.entities.Folder.delete(folder.id);
    }
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
    photos,
    onProgress,
  });

  const reconciled = await reconcileOrganizeBatch({
    batchPhotos: photosToOrganize,
    afterFolders,
    labelByPhotoNormId,
    onProgress,
  });

  const apiFolders = reconciled.apiFolders || [];
  afterFolders = mergeApiFoldersWithLocal(apiFolders, reconciled.folders);

  const missedPhotos = getUnorganizedPhotos(photosToOrganize, apiFolders);
  const actuallySaved = photosToOrganize.length - missedPhotos.length;

  // Prefer verified in-memory folders when list/get lag behind but one-by-one saves ran
  const localMissed = getUnorganizedPhotos(photosToOrganize, afterFolders).length;
  const savedCount = Math.max(actuallySaved, photosToOrganize.length - localMissed);

  if (savedCount === 0 && photosToOrganize.length > 0) {
    return {
      ok: false,
      reason: "Organize could not save photos into folders. Pull down to refresh, then try again.",
    };
  }

  return {
    ok: true,
    foldersSaved: new Set(allLabels.map((l) => l.folder)).size,
    totalSaved: savedCount,
    totalToOrganize: photosToOrganize.length,
    missed: photosToOrganize.length - savedCount,
    afterFolders,
    apiFolders,
    photosToOrganize,
    labelByPhotoNormId,
  };
}
