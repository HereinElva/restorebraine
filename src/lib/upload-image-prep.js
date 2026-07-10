import {
  IMAGE_COMPRESS_MIN_BYTES,
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_DIMENSION,
  IMAGE_PREP_CONCURRENCY,
} from '@/lib/media-constants';
import { runConcurrent } from '@/lib/concurrency';

function shouldCompressImage(file) {
  if (!file || !file.type?.startsWith('image/')) return false;
  if (file.type === 'image/gif') return false;
  return file.size >= IMAGE_COMPRESS_MIN_BYTES;
}

function scaledDimensions(width, height, maxDim) {
  if (width <= maxDim && height <= maxDim) {
    return { width, height, resized: false };
  }
  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, cleanup: () => bitmap.close?.() };
    } catch {
      /* fall through */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });
    return { source: img, cleanup: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Downscale large camera-roll photos before upload — biggest win on iPhone.
 */
export async function prepareImageForUpload(file) {
  if (!shouldCompressImage(file)) return file;

  let cleanup = () => {};
  try {
    const { source, cleanup: release } = await loadImageSource(file);
    cleanup = release;

    const srcWidth = source.width;
    const srcHeight = source.height;
    const { width, height, resized } = scaledDimensions(
      srcWidth,
      srcHeight,
      IMAGE_MAX_DIMENSION,
    );

    if (!resized && file.size < IMAGE_COMPRESS_MIN_BYTES * 1.5) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;

    ctx.drawImage(source, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size * 0.92) {
      return file;
    }

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error) {
    console.warn('Image prep failed, uploading original:', error);
    return file;
  } finally {
    cleanup();
  }
}

export async function prepareUploadFiles(files, { onItemProgress } = {}) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  const prepared = await runConcurrent(
    list.map((file, index) => async () => {
      onItemProgress?.(index, { phase: 'preparing', progress: 3 });
      const next = await prepareImageForUpload(file);
      onItemProgress?.(index, { progress: 8 });
      return next;
    }),
    IMAGE_PREP_CONCURRENCY,
  );

  return prepared;
}
