import { base44 } from '@/api/base44Client';

function isRateLimitError(error) {
  const msg = String(error?.message || error?.data?.message || error || '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429');
}

export function formatLLMError(error) {
  if (isRateLimitError(error)) {
    return 'AI requests are temporarily limited — wait about a minute and try again. This is not your 250-photo storage limit.';
  }
  return error?.message || 'AI request failed. Please try again.';
}

/** InvokeLLM with backoff when Base44 returns rate-limit errors. */
export async function invokeLLMWithRetry(args, { maxRetries = 5, baseDelayMs = 2500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await base44.integrations.Core.InvokeLLM(args);
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
