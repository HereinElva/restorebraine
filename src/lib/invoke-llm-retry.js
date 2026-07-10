import { base44 } from '@/api/base44Client';

function isRateLimitError(error) {
  const msg = String(error?.message || error?.data?.message || error || '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429');
}

export function withTimeout(promise, ms, label = 'Request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out — try again`)), ms);
    }),
  ]);
}

export function formatLLMError(error) {
  const msg = String(error?.message || error || '');
  if (isRateLimitError(error)) {
    return 'Organize could not finish — AI is temporarily busy. Wait about a minute and try again. (This is not your 250-photo storage limit.)';
  }
  if (/timed out/i.test(msg)) {
    return 'Organize took too long — try again with fewer loose photos.';
  }
  return error?.message || 'Organize failed. Please try again.';
}

/** InvokeLLM with backoff and per-attempt timeout. */
export async function invokeLLMWithRetry(
  args,
  { maxRetries = 2, baseDelayMs = 2000, timeoutMs = 45000 } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(
        base44.integrations.Core.InvokeLLM(args),
        timeoutMs,
        'AI request',
      );
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
