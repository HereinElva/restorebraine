import axios from 'axios';
import { base44 } from '@/api/base44Client';
import { appParams, getAppOrigin } from '@/lib/app-params';
import { captureAccessTokenFromUrl } from '@/lib/native-oauth-fix';
import { persistentStorage } from '@/lib/persistentStorage';
import { setGalleryOrganizeSnapshot } from '@/lib/gallery-organize-snapshot';

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

export function finishPendingOAuthLogin() {
  if (typeof window === 'undefined') return;
  try {
    delete window.__restorebrainePendingOAuth;
  } catch {}
}

export const restoreSessionFromNativeStorage = async () => {
  const urlToken = captureAccessTokenFromUrl();
  if (urlToken) {
    finishPendingOAuthLogin();
    await persistSessionToNativeStorage(urlToken);
    return urlToken;
  }

  if (typeof window !== 'undefined' && window.__restorebrainePendingOAuth) {
    return null;
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

export function applyAuthSessionTokenSync(token) {
  if (!token) return;
  try { localStorage.removeItem(SIGNED_OUT_KEY); } catch {}
  appParams.token = token;
  base44.auth.setToken(token, false);
  persistentStorage._mirror('base44_access_token', token);
  persistentStorage._mirror('token', token);
}

export const persistSessionToNativeStorage = async (token) => {
  if (!token) return;
  applyAuthSessionTokenSync(token);

  void Promise.race([
    (async () => {
      await persistentStorage.remove(SIGNED_OUT_KEY);
      await Promise.all(TOKEN_KEYS.map((key) => persistentStorage.set(key, token)));
    })(),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
};

export function normalizeAuthEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Remove Bearer auth from axios global defaults (setToken(null) does not). */
export function clearAxiosAuthHeaders() {
  try {
    delete axios.defaults.headers.common.Authorization;
  } catch {}
}

function clearNativePersistedTokensForRegistration() {
  if (typeof window === 'undefined') return;
  try {
    delete window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__;
  } catch {}
  try {
    if (window.webkit?.messageHandlers?.restorebraineNativeSession) {
      window.webkit.messageHandlers.restorebraineNativeSession.postMessage({ action: 'clearTokens' });
    }
  } catch {}
}

/** Clear HTTP-only auth cookies so a new registration is not tied to a prior session. */
export async function clearServerAuthCookies() {
  if (typeof window === 'undefined') return;
  const logoutUrls = [
    `${appParams.serverUrl}/api/apps/auth/logout`,
    `${getAppOrigin()}/api/apps/auth/logout`,
  ];
  await Promise.all(
    logoutUrls.map((url) =>
      Promise.race([
        fetch(url, { method: 'GET', credentials: 'include', cache: 'no-store' }).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]),
    ),
  );
}

async function clearStoredAuthTokensOnly() {
  appParams.token = null;
  base44.auth.setToken(null, false);
  clearAxiosAuthHeaders();
  try {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('base44_logged_out');
  } catch {}
  for (const key of TOKEN_KEYS) {
    await persistentStorage.remove(key);
  }
}

function withStorageTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`${label} timed out after ${ms}ms — continuing`);
        resolve(undefined);
      }, ms);
    }),
  ]);
}

/** Wipe client + server auth state before creating a brand-new account. */
export async function prepareForNewRegistration() {
  clearNativePersistedTokensForRegistration();
  await withStorageTimeout(clearStoredAuthTokensOnly(), 4000, 'clearStoredAuthTokensOnly');
  clearAxiosAuthHeaders();
  await clearServerAuthCookies();
  try {
    localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {}
  await withStorageTimeout(persistentStorage.remove(SIGNED_OUT_KEY), 2000, 'persistentStorage.remove(signed_out)');
  clearAxiosAuthHeaders();
}

/** Clear stale tokens before OAuth so a prior account is not restored. */
export async function prepareForOAuthLogin() {
  if (typeof window !== 'undefined') {
    window.__restorebrainePendingOAuth = Date.now();
    window.__restorebraineSigningOut = false;
    try {
      delete window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__;
    } catch {}
  }
  clearNativePersistedTokensForRegistration();
  await withStorageTimeout(clearStoredAuthTokensOnly(), 4000, 'clearStoredAuthTokensOnly');
  clearAxiosAuthHeaders();
  await clearServerAuthCookies();
  try {
    localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {}
  await withStorageTimeout(persistentStorage.remove(SIGNED_OUT_KEY), 2000, 'persistentStorage.remove(signed_out)');
}

export const clearNativeSession = async () => {
  appParams.token = null;
  base44.auth.setToken(null, false);
  clearAxiosAuthHeaders();
  try {
    localStorage.setItem(SIGNED_OUT_KEY, '1');
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('base44_logged_out');
  } catch {}
  if (typeof window !== 'undefined') {
    window.__restorebraineSigningOut = true;
    finishPendingOAuthLogin();
    try {
      delete window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__;
    } catch {}
    setGalleryOrganizeSnapshot({ folders: [], photos: [] });
    try {
      window.dispatchEvent(new CustomEvent('restorebraine-clear-client-caches'));
    } catch {}
    if (window.__restorebraineClearSession) {
      window.__restorebraineClearSession();
    }
  }
  await clearServerAuthCookies();
  await persistentStorage.set(SIGNED_OUT_KEY, '1');
  for (const key of TOKEN_KEYS) {
    await persistentStorage.remove(key);
  }
};
