import { invokeLLMWithRetry, withTimeout } from "@/lib/invoke-llm-retry";
import {
  assignFolderLocally,
  balanceOrganizeLabels,
  buildFolderOptions,
  buildLabelPrompt,
  ORGANIZE_BATCH_SIZE,
  parseCustomFolderHints,
  photoDataForOrganize,
  TARGET_FOLDERS_PER_RUN,
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

const SAVE_BATCH_SIZE = ORGANIZE_BATCH_SIZE;
const LLM_TIMEOUT_MS = 22000;
const ORGANIZE_RUN_TIMEOUT_MS = 70000;
const MISC_FOLDER = "Miscellaneous";

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

async function labelBatchWithAI(batchPhotos, customInstructions) {
  const customFolderHints = parseCustomFolderHints(customInstructions);
  const photoData = batchPhotos.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions([], customFolderHints);

  const result = await invokeLLMWithRetry(
    {
      prompt: buildLabelPrompt({
        photoData,
        folderOptions,
        customInstructions,
        targetFolderCount: TARGET_FOLDERS_PER_RUN,
      }),
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
    { maxRetries: 0, baseDelayMs: 1500, timeoutMs: LLM_TIMEOUT_MS },
  );

  return result.labels || [];
}

function labelBatchLocally(batchPhotos) {
  return batchPhotos.map((photo) => ({
    id: normalizePhotoId(photo.id),
    folder: assignFolderLocally(photo),
  }));
}

async function buildLabelsFromDescriptions(
  batchPhotos,
  customInstructions,
  validPhotoIds,
  onProgress,
) {
  const useAi = Boolean(customInstructions?.trim());
  onProgress?.(useAi ? "AI grouping…" : "Grouping…");

  let rawLabels;
  if (useAi) {
    try {
      rawLabels = await labelBatchWithAI(batchPhotos, customInstructions);
    } catch (error) {
      console.warn("AI organize failed, using local fallback:", error);
      rawLabels = labelBatchLocally(batchPhotos);
    }
  } else {
    rawLabels = labelBatchLocally(batchPhotos);
  }

  const allLabels = [];
  for (const label of rawLabels) {
    const id = normalizePhotoId(label.id);
    if (validPhotoIds.has(id)) {
      allLabels.push({ id, folder: label.folder || MISC_FOLDER });
    }
  }

  const labelledIds = new Set(allLabels.map((l) => l.id));
  for (const photo of batchPhotos) {
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
  return withTimeout(
    runMediaOrganizeInner({
      photos,
      folders: foldersSnapshot,
      includeOrganized,
      customInstructions,
      onProgress,
      onPartialSave,
      userEmail,
    }),
    ORGANIZE_RUN_TIMEOUT_MS,
    "Organize",
  );
}

async function runMediaOrganizeInner({
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

  // Skip Folder.list on normal organize — it often hangs; UI folders are enough.
  let apiFolders = [];
  if (includeOrganized) {
    onProgress?.("Checking folders…");
    apiFolders = sanitizeFoldersLocally(
      await listAllFoldersSafe({ timeoutMs: 5000 }),
      photos,
      allPhotoIds,
    );
  }

  const liveFolderSource = includeOrganized ? apiFolders : uiFolders;

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
      ? `Sorting ${batchPhotos.length} of ${photosToOrganize.length}…`
      : `Sorting ${batchPhotos.length} item${batchPhotos.length !== 1 ? "s" : ""}…`,
  );

  const validPhotoIds = new Set(batchPhotos.map((p) => normalizePhotoId(p.id)));

  const rawLabels = await buildLabelsFromDescriptions(
    batchPhotos,
    customInstructions,
    validPhotoIds,
    onProgress,
  );

  const folderTarget =
    batchPhotos.length >= TARGET_FOLDERS_PER_RUN * 2
      ? TARGET_FOLDERS_PER_RUN
      : Math.max(1, Math.min(TARGET_FOLDERS_PER_RUN, Math.floor(batchPhotos.length / 2)));

  const allLabels = balanceOrganizeLabels(rawLabels, batchPhotos, {
    targetCount: folderTarget,
  });

  onProgress?.("Saving…");

  const liveFolders = includeOrganized ? [] : liveFolderSource;
  const labelByPhotoNormId = new Map(allLabels.map((l) => [l.id, l.folder]));

  const saveResult = await assignLoosePhotosByFolder({
    photosToAssign: batchPhotos,
    labelByPhotoNormId,
    liveFolders,
    onProgress,
    onPartialSave,
    userEmail,
    useOrganizeFolderNames: true,
    parallelSaves: true,
  });

  const afterFolders = saveResult.folders;
  const failedNormIds = new Set((saveResult.failedPhotoIds || []).map(normalizePhotoId));

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
    apiFolders: afterFolders,
    photosToOrganize: batchPhotos,
    labelByPhotoNormId,
  };
}
