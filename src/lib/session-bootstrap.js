import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { captureAccessTokenFromUrl } from '@/lib/native-oauth-fix';
import { persistentStorage } from '@/lib/persistentStorage';

const TOKEN_KEYS = ['base44_access_token', 'token'];

export const restoreSessionFromNativeStorage = async () => {
  const urlToken = captureAccessTokenFromUrl();
  if (urlToken) {
    await persistSessionToNativeStorage(urlToken);
    return urlToken;
  }

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

export const installNativeSessionPersistence = async () => {
  try {
    const { isNativeShell } = await import('@/lib/native-hosted-redirect');
    if (!isNativeShell()) return;

    const { App } = await import('@capacitor/app');

    await App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        await restoreSessionFromNativeStorage();
        return;
      }

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
  appParams.token = token;
  base44.auth.setToken(token, false);
  persistentStorage._mirror('base44_access_token', token);
  persistentStorage._mirror('token', token);
  await Promise.all(TOKEN_KEYS.map((key) => persistentStorage.set(key, token)));
};

export const clearNativeSession = async () => {
  appParams.token = null;
  for (const key of TOKEN_KEYS) {
    await persistentStorage.remove(key);
  }
  try {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('base44_logged_out');
  } catch {}
};
