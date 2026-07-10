/** Per-item upload+save pipeline — runs upload and save in parallel across files. */
export const UPLOAD_PIPELINE_CONCURRENCY = 4;

/** Background AI analysis after save — does not block the upload UI. */
export const BACKGROUND_ANALYSIS_CONCURRENCY = 2;

/** Parallel uploads within each item (legacy phased batch). */
export const UPLOAD_CONCURRENCY = UPLOAD_PIPELINE_CONCURRENCY;

/** Parallel AI vision calls when analysis blocks save (retries only). */
export const ANALYSIS_CONCURRENCY = 2;

/** Parallel DB writes. */
export const SAVE_CONCURRENCY = 6;

/** Max files accepted in one selection. */
export const MAX_BATCH_SIZE = 100;

/** Max video file size (~5 min). */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/** Per-file upload timeout (large videos on LTE). */
export const UPLOAD_TIMEOUT_MS = 90000;

/** Retries for transient network failures. */
export const UPLOAD_MAX_RETRIES = 2;

/** Background vision analysis timeout — runs after save. */
export const UPLOAD_ANALYSIS_TIMEOUT_MS = 35000;

/** Overall batch watchdog — prevents infinite stall. */
export const UPLOAD_BATCH_TIMEOUT_MS = 600000;
