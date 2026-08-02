import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { captureAccessTokenFromUrl } from '@/lib/native-oauth-fix';
import { persistentStorage } from '@/lib/persistentStorage';

const TOKEN_KEYS = ['base44_access_token', 'token'];
const SIGNED_OUT_KEY = 'b44_signed_out';

const readSyncToken = () => {
  try {
    if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
    return localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  } catch {
    return null;
  }
};

/** Apply stored token to base44 client synchronously — must run before gallery API queries. */
export function ensureClientSessionToken() {
  if (typeof window === 'undefined') return null;
  try {
    if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
  } catch {}

  let token = readSyncToken();
  const injected = window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__;
  if (
    !token
    && injected
    && injected !== 'SYNC_TOKEN_PLACEHOLDER'
    && !String(injected).includes('PLACEHOLDER')
  ) {
    token = injected;
    persistentStorage._mirror('base44_access_token', token);
    persistentStorage._mirror('token', token);
  }

  if (!token) return null;
  appParams.token = token;
  base44.auth.setToken(token, false);
  return token;
}

export const hasStoredSessionToken = () => Boolean(readSyncToken());

export const restoreSessionFromNativeStorage = async () => {
  const urlToken = captureAccessTokenFromUrl();
  if (urlToken) {
    await persistSessionToNativeStorage(urlToken);
    return urlToken;
  }

  try {
    if (typeof window !== 'undefined' && localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
  } catch {}

  const syncToken = readSyncToken();
  if (syncToken) {
    appParams.token = syncToken;
    base44.auth.setToken(syncToken, false);
    return syncToken;
  }

  const signedOut = await persistentStorage.get(SIGNED_OUT_KEY);
  if (signedOut === '1') return null;

  for (const key of TOKEN_KEYS) {
    const storedToken = await persistentStorage.get(key);
    if (!storedToken) continue;

    appParams.token = storedToken;
    persistentStorage._mirror('base44_access_token', storedToken);
    persistentStorage._mirror('token', storedToken);
    base44.auth.setToken(storedToken, false);
    return storedToken;
  }

  return null;
};


export const installNativeOAuthDeepLinkHandler = async () => {
  try {
    const { isNativeShell } = await import('@/lib/native-hosted-redirect');
    if (!isNativeShell()) return;

    const { waitForCapacitorBridge, withTimeout } = await import('@/lib/capacitor-ready');
    await waitForCapacitorBridge();

    const { App } = await import('@capacitor/app');
    const { handleNativeOAuthCallback, tryRestoreSessionAfterOAuth } = await import('@/lib/native-google-oauth');

    await withTimeout(
      App.addListener('appUrlOpen', async ({ url }) => {
        if (!url || !url.includes('access_token=')) return;
        if (await handleNativeOAuthCallback(url)) return;
        await tryRestoreSessionAfterOAuth();
      }),
      5000,
      'App.addListener(appUrlOpen)',
    );
  } catch (error) {
    console.warn('Native OAuth deep link handler unavailable.', error);
  }
};

export const installNativeSessionPersistence = async () => {
  try {
    const { isNativeShell } = await import('@/lib/native-hosted-redirect');
    if (!isNativeShell()) return;

    const { waitForCapacitorBridge, withTimeout } = await import('@/lib/capacitor-ready');
    await waitForCapacitorBridge();

    await installNativeOAuthDeepLinkHandler();

    const { App } = await import('@capacitor/app');

    await withTimeout(
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          if (localStorage.getItem(SIGNED_OUT_KEY) !== '1') {
            await restoreSessionFromNativeStorage();
          }
          return;
        }

        if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return;

        const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
        if (token) {
          await persistSessionToNativeStorage(token);
        }
      }),
      5000,
      'App.addListener(appStateChange)',
    );
  } catch (error) {
    console.warn('Native session persistence listener unavailable.', error);
  }
};

export const persistSessionToNativeStorage = async (token) => {
  if (!token) return;
  await persistentStorage.remove(SIGNED_OUT_KEY);
  try { localStorage.removeItem(SIGNED_OUT_KEY); } catch {}
  appParams.token = token;
  base44.auth.setToken(token, false);
  persistentStorage._mirror('base44_access_token', token);
  persistentStorage._mirror('token', token);
  await Promise.all(TOKEN_KEYS.map((key) => persistentStorage.set(key, token)));
};

export function normalizeAuthEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Clear HTTP-only auth cookies so a new registration is not tied to a prior session. */
export async function clearServerAuthCookies() {
  if (typeof window === 'undefined') return;
  try {
    await Promise.race([
      fetch(`${appParams.serverUrl}/api/apps/auth/logout`, {
        method: 'GET',
        credentials: 'include',
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch (error) {
    console.warn('Server auth cookie clear failed:', error);
  }
}

async function clearStoredAuthTokensOnly() {
  appParams.token = null;
  try {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('base44_logged_out');
    base44.auth.setToken(null, false);
  } catch {}
  for (const key of TOKEN_KEYS) {
    await persistentStorage.remove(key);
  }
}

/** Wipe client + server auth state before creating a brand-new account. */
export async function prepareForNewRegistration() {
  await clearStoredAuthTokensOnly();
  await clearServerAuthCookies();
  try {
    localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {}
  await persistentStorage.remove(SIGNED_OUT_KEY);
}

export const clearNativeSession = async () => {
  appParams.token = null;
  await clearServerAuthCookies();
  await persistentStorage.set(SIGNED_OUT_KEY, '1');
  try {
    localStorage.setItem(SIGNED_OUT_KEY, '1');
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('base44_logged_out');
    base44.auth.setToken(null, false);
  } catch {}
  if (typeof window !== 'undefined' && window.__restorebraineClearSession) {
    window.__restorebraineClearSession();
  }
  for (const key of TOKEN_KEYS) {
    await persistentStorage.remove(key);
  }
};
