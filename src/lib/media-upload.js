import { base44 } from '@/api/base44Client';
import { analyzeMedia } from '@/lib/media-analysis';
import { runConcurrent } from '@/lib/concurrency';
import { withTimeout } from '@/lib/invoke-llm-retry';
import {
  ANALYSIS_CONCURRENCY,
  MAX_BATCH_SIZE,
  MAX_VIDEO_BYTES,
  SAVE_CONCURRENCY,
  UPLOAD_BATCH_TIMEOUT_MS,
  UPLOAD_CONCURRENCY,
  UPLOAD_MAX_RETRIES,
  UPLOAD_TIMEOUT_MS,
} from '@/lib/media-constants';

export {
  ANALYSIS_CONCURRENCY,
  MAX_BATCH_SIZE,
  MAX_VIDEO_BYTES,
  SAVE_CONCURRENCY,
  UPLOAD_BATCH_TIMEOUT_MS,
  UPLOAD_CONCURRENCY,
  UPLOAD_MAX_RETRIES,
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
      await sleep(1500 * (attempt + 1));
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

/**
 * Three-phase pipeline: upload → analyze → save.
 * Each phase runs in parallel for maximum throughput on large batches.
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

  const uploadTasks = queueItems.map((item, index) => async () => {
    update(index, { status: 'processing', progress: 15, error: null, phase: 'uploading' });
    try {
      const result = await uploadFile(item.file);
      update(index, { progress: 40, file_url: result.file_url, phase: 'uploaded' });
      return { index, file_url: result.file_url, error: null };
    } catch (error) {
      const message = error?.message || 'Upload failed';
      update(index, { status: 'error', error: message, progress: 0, phase: 'error' });
      return { index, file_url: null, error: message };
    }
  });

  const uploadResults = await runConcurrent(uploadTasks, UPLOAD_CONCURRENCY);

  const toAnalyze = uploadResults.filter((r) => r.file_url);
  const analysisTasks = toAnalyze.map(({ index, file_url }) => async () => {
    const item = queueItems[index];
    const fileType = getFileType(item.file);
    update(index, { progress: 55, phase: 'analyzing' });

    try {
      const analysis = await analyzeMedia(file_url, fileType, item.file.name);
      update(index, {
        progress: 75,
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
        phase: 'analyzed',
      });
      return { index, file_url, fileType, analysis, error: null };
    } catch (error) {
      const message = error?.message || 'Analysis failed';
      update(index, { status: 'error', error: message, progress: 0, phase: 'error' });
      return { index, file_url, fileType: getFileType(item.file), analysis: null, error: message };
    }
  });

  const analysisResults = await runConcurrent(analysisTasks, ANALYSIS_CONCURRENCY);

  const toSave = analysisResults.filter((r) => r.analysis);
  const saveTasks = toSave.map(({ index, file_url, fileType, analysis }) => async () => {
    update(index, { progress: 90, phase: 'saving' });
    const item = queueItems[index];

    try {
      await savePhoto({
        file_url,
        file_type: fileType,
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
        original_filename: item.file.name,
      });
      update(index, {
        status: 'success',
        progress: 100,
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
        phase: 'done',
      });
      return { index, success: true };
    } catch (error) {
      const message = error?.message || 'Save failed';
      update(index, { status: 'error', error: message, progress: 0, phase: 'error' });
      return { index, success: false };
    }
  });

  await runConcurrent(saveTasks, SAVE_CONCURRENCY);

  return {
    successCount: toSave.length,
    errorCount: queueItems.length - toSave.length,
  };
}

export async function processSingleUpload(item, { onUpdate } = {}) {
  const patch = (updates) => onUpdate?.(updates);
  patch({ status: 'processing', progress: 10, error: null, phase: 'uploading' });

  try {
    const uploadResult = await uploadFile(item.file);
    patch({ progress: 40, phase: 'analyzing' });

    const fileType = getFileType(item.file);
    const analysis = await analyzeMedia(
      uploadResult.file_url,
      fileType,
      item.file.name,
    );
    patch({ progress: 80, phase: 'saving' });

    await savePhoto({
      file_url: uploadResult.file_url,
      file_type: fileType,
      ai_description: analysis.ai_description,
      ai_tags: analysis.ai_tags,
      original_filename: item.file.name,
    });

    patch({
      status: 'success',
      progress: 100,
      ai_description: analysis.ai_description,
      ai_tags: analysis.ai_tags,
      phase: 'done',
    });
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
