/** Parallel uploads — bandwidth-bound. */
export const UPLOAD_CONCURRENCY = 6;

/** Parallel AI vision calls — rate-limit sensitive. */
export const ANALYSIS_CONCURRENCY = 4;

/** Parallel DB writes after analysis. */
export const SAVE_CONCURRENCY = 8;

/** Max files accepted in one selection. */
export const MAX_BATCH_SIZE = 100;

/** Max video file size (~5 min). */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
