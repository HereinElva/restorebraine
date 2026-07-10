/** Parallel uploads — keep low on mobile to avoid network errors. */
export const UPLOAD_CONCURRENCY = 3;

/** Parallel AI vision calls — rate-limit sensitive. */
export const ANALYSIS_CONCURRENCY = 3;

/** Parallel DB writes after analysis. */
export const SAVE_CONCURRENCY = 4;

/** Max files accepted in one selection. */
export const MAX_BATCH_SIZE = 100;

/** Max video file size (~5 min). */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/** Per-file upload timeout (large videos on LTE). */
export const UPLOAD_TIMEOUT_MS = 120000;

/** Retries for transient network failures. */
export const UPLOAD_MAX_RETRIES = 3;

/** Overall batch watchdog — prevents infinite stall. */
export const UPLOAD_BATCH_TIMEOUT_MS = 600000;
