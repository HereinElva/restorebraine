import { base44 } from '@/api/base44Client';
import { analyzeMedia } from '@/lib/media-analysis';
import { enrichTags, tokenize } from '@/lib/media-tags';
import { runConcurrent } from '@/lib/concurrency';
import { withTimeout } from '@/lib/invoke-llm-retry';
import { prepareUploadFiles } from '@/lib/upload-image-prep';
import { runUploadSavePipeline } from '@/lib/upload-pipeline';
import {
  BACKGROUND_ANALYSIS_CONCURRENCY,
  MAX_BATCH_SIZE,
  MAX_VIDEO_BYTES,
  SAVE_PIPELINE_CONCURRENCY,
  UPLOAD_ANALYSIS_TIMEOUT_MS,
  UPLOAD_BATCH_TIMEOUT_MS,
  UPLOAD_MAX_RETRIES,
  UPLOAD_PIPELINE_CONCURRENCY,
  UPLOAD_TIMEOUT_MS,
} from '@/lib/media-constants';

export {
  BACKGROUND_ANALYSIS_CONCURRENCY,
  MAX_BATCH_SIZE,
  MAX_VIDEO_BYTES,
  SAVE_PIPELINE_CONCURRENCY,
  UPLOAD_ANALYSIS_TIMEOUT_MS,
  UPLOAD_BATCH_TIMEOUT_MS,
  UPLOAD_MAX_RETRIES,
  UPLOAD_PIPELINE_CONCURRENCY,
  UPLOAD_TIMEOUT_MS,
} from '@/lib/media-constants';

export function getFileType(file) {
  const type = file?.type || '';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  const name = (file?.name || '').toLowerCase();
  if (/\.(mp4|mov|m4v|avi|webm|mkv)$/.test(name)) return 'video';
  return 'image';
}

export function validateFiles(files) {
  const list = Array.from(files || []).filter((f) => f && (f.size > 0 || f.name));
  if (!list.length) {
    return {
      valid: [],
      error: 'No files received from picker. Try again or allow full photo access in Settings.',
    };
  }

  const readable = list.filter((f) => f.size > 0);
  if (!readable.length) {
    return {
      valid: [],
      error: 'Selected files could not be read. In Settings → Restorebraine → Photos, try Full Access.',
    };
  }

  if (readable.length > MAX_BATCH_SIZE) {
    return {
      valid: [],
      error: `Please select up to ${MAX_BATCH_SIZE} files at a time. You can add more after this batch starts.`,
    };
  }

  const oversized = readable.find(
    (f) => getFileType(f) === 'video' && f.size > MAX_VIDEO_BYTES,
  );
  if (oversized) {
    return {
      valid: [],
      error: `${oversized.name} is too large. Videos must be under 5 minutes / 500MB.`,
    };
  }

  return { valid: readable, error: null };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection') ||
    msg.includes('abort') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504')
  );
}

function quickMetadataFromFilename(filename, fileType) {
  const base = (filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const label = base || (fileType === 'video' ? 'Video memory' : 'Photo memory');
  const tags = enrichTags(label, [fileType, ...tokenize(label)]);
  return {
    ai_description: label,
    ai_tags: tags,
  };
}

async function uploadFile(file) {
  let lastError;
  for (let attempt = 0; attempt < UPLOAD_MAX_RETRIES; attempt++) {
    try {
      return await withTimeout(
        base44.integrations.Core.UploadFile({ file }),
        UPLOAD_TIMEOUT_MS,
        'Upload',
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt === UPLOAD_MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastError || new Error('Upload failed');
}

async function savePhoto({ file_url, file_type, ai_description, ai_tags, original_filename }) {
  return base44.entities.Photo.create({
    file_url,
    file_type,
    ai_description,
    ai_tags,
    upload_date: new Date().toISOString(),
    original_filename,
  });
}

async function analyzeAndUpdatePhoto(photoId, fileUrl, fileType, filename) {
  if (!photoId) return;
  try {
    const analysis = await analyzeMedia(fileUrl, fileType, filename, {
      fast: true,
      timeoutMs: UPLOAD_ANALYSIS_TIMEOUT_MS,
    });
    await base44.entities.Photo.update(photoId, {
      ai_description: analysis.ai_description,
      ai_tags: analysis.ai_tags,
    });
  } catch (error) {
    console.warn('Background analysis failed for photo', photoId, error);
  }
}

/**
 * Fast pipeline: compress → overlapping upload/save → background AI.
 */
export async function processUploadBatch(queueItems, { onItemUpdate } = {}) {
  return withTimeout(
    processUploadBatchInner(queueItems, { onItemUpdate }),
    UPLOAD_BATCH_TIMEOUT_MS,
    'Upload batch',
  );
}

async function processUploadBatchInner(queueItems, { onItemUpdate } = {}) {
  const update = (index, patch) => onItemUpdate?.(index, patch);

  const preparedFiles = await prepareUploadFiles(
    queueItems.map((item) => item.file),
    { onItemProgress: (index, patch) => update(index, patch) },
  );

  const preparedItems = queueItems.map((item, index) => ({
    ...item,
    file: preparedFiles[index] || item.file,
  }));

  const pipelineResults = await runUploadSavePipeline({
    items: preparedItems,
    uploadConcurrency: UPLOAD_PIPELINE_CONCURRENCY,
    saveConcurrency: SAVE_PIPELINE_CONCURRENCY,
    uploadOne: async (item, index) => {
      update(index, { status: 'processing', progress: 12, error: null, phase: 'uploading' });
      try {
        const uploadResult = await uploadFile(item.file);
        update(index, { progress: 62, file_url: uploadResult.file_url, phase: 'uploaded' });
        return {
          index,
          file_url: uploadResult.file_url,
          fileType: getFileType(item.file),
          filename: item.file.name,
        };
      } catch (error) {
        const message = error?.message || 'Upload failed';
        update(index, { status: 'error', error: message, progress: 0, phase: 'error' });
        return null;
      }
    },
    saveOne: async ({ item, index, uploaded }) => {
      update(index, { progress: 78, phase: 'saving' });
      const quickMeta = quickMetadataFromFilename(item.file.name, uploaded.fileType);

      try {
        const saved = await savePhoto({
          file_url: uploaded.file_url,
          file_type: uploaded.fileType,
          ai_description: quickMeta.ai_description,
          ai_tags: quickMeta.ai_tags,
          original_filename: item.file.name,
        });

        update(index, {
          status: 'success',
          progress: 100,
          ai_description: quickMeta.ai_description,
          ai_tags: quickMeta.ai_tags,
          phase: 'done',
          photoId: saved?.id,
        });

        return {
          index,
          success: true,
          photoId: saved?.id,
          fileUrl: uploaded.file_url,
          fileType: uploaded.fileType,
          filename: item.file.name,
        };
      } catch (error) {
        const message = error?.message || 'Save failed';
        update(index, { status: 'error', error: message, progress: 0, phase: 'error' });
        return { index, success: false };
      }
    },
  });

  const results = pipelineResults.filter(Boolean);
  const backgroundJobs = results
    .filter((result) => result.success && result.photoId)
    .map(
      (result) => () =>
        analyzeAndUpdatePhoto(
          result.photoId,
          result.fileUrl,
          result.fileType,
          result.filename,
        ),
    );

  if (backgroundJobs.length) {
    void runConcurrent(backgroundJobs, BACKGROUND_ANALYSIS_CONCURRENCY);
  }

  const successCount = results.filter((result) => result.success).length;
  return {
    successCount,
    errorCount: queueItems.length - successCount,
  };
}

export async function processSingleUpload(item, { onUpdate } = {}) {
  const patch = (updates) => onUpdate?.(updates);
  patch({ status: 'processing', progress: 8, error: null, phase: 'preparing' });

  try {
    const [prepared] = await prepareUploadFiles([item.file]);
    const file = prepared || item.file;

    patch({ progress: 12, phase: 'uploading' });
    const uploadResult = await uploadFile(file);
    const fileType = getFileType(file);
    const quickMeta = quickMetadataFromFilename(file.name, fileType);

    patch({ progress: 78, phase: 'saving' });

    const saved = await savePhoto({
      file_url: uploadResult.file_url,
      file_type: fileType,
      ai_description: quickMeta.ai_description,
      ai_tags: quickMeta.ai_tags,
      original_filename: file.name,
    });

    patch({
      status: 'success',
      progress: 100,
      ai_description: quickMeta.ai_description,
      ai_tags: quickMeta.ai_tags,
      phase: 'done',
    });

    void analyzeAndUpdatePhoto(saved?.id, uploadResult.file_url, fileType, file.name);
    return true;
  } catch (error) {
    patch({
      status: 'error',
      error: error?.message || 'Upload failed',
      progress: 0,
      phase: 'error',
    });
    return false;
  }
}
