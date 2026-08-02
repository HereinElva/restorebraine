import { appParams } from '@/lib/app-params';

/**
 * Email auth via fetch — avoids axios global Authorization headers that cause false "already exists".
 */
export async function postAuthEmail(path, body, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${appParams.serverUrl}/api/apps/${appParams.appId}/auth/${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-App-Id': appParams.appId,
        },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data.message || data.detail || `Unable to ${path}`;
      throw Object.assign(new Error(message), {
        status: response.status,
        data: { ...data, message },
      });
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error(`auth.${path} timed out`), { status: 408 });
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
