import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { captureAccessTokenFromUrl } from '@/lib/native-oauth-fix';
import { persistentStorage } from '@/lib/persistentStorage';

const TOKEN_KEYS = ['base44_access_token', 'token'];
const SIGNED_OUT_KEY = 'b44_signed_out';
const PREFERENCES_TIMEOUT_MS = 2000;

const readSyncToken = () => {
  try {
    if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
    return localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  } catch {
    return null;
  }
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);

export const restoreSessionFromNativeStorage = async () => {
  const urlToken = captureAccessTokenFromUrl();
  if (urlToken) {
    await persistSessionToNativeStorage(urlToken);
    return urlToken;
  }

  const syncToken = readSyncToken();
  if (syncToken) {
    appParams.token = syncToken;
    base44.auth.setToken(syncToken, false);
    return syncToken;
  }

  try {
    if (typeof window !== 'undefined' && localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
  } catch {}

  const signedOut = await withTimeout(persistentStorage.get(SIGNED_OUT_KEY), PREFERENCES_TIMEOUT_MS);
  if (signedOut === '1') return null;

  for (const key of TOKEN_KEYS) {
    const storedToken = await withTimeout(persistentStorage.get(key), PREFERENCES_TIMEOUT_MS);
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

    const { App } = await import('@capacitor/app');
    const { handleNativeOAuthCallback } = await import('@/lib/native-google-oauth');

    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.includes('access_token=')) return;
      await handleNativeOAuthCallback(url);
    });
  } catch (error) {
    console.warn('Native OAuth deep link handler unavailable.', error);
  }
};

export const installNativeSessionPersistence = async () => {
  try {
    const { isNativeShell, isHostedAppOrigin } = await import('@/lib/native-hosted-redirect');
    if (!isNativeShell() || isHostedAppOrigin()) return;

    await installNativeOAuthDeepLinkHandler();

    const { App } = await import('@capacitor/app');

    await App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        if (localStorage.getItem(SIGNED_OUT_KEY) !== '1') {
          const token = await restoreSessionFromNativeStorage();
          if (token) {
            window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
          }
        }
        return;
      }

      if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return;

      const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (token) {
        await persistSessionToNativeStorage(token);
      }
    });
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

export const clearNativeSession = async () => {
  appParams.token = null;
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
