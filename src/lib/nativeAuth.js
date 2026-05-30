import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { appParams, BASE44_SERVER_URL } from '@/lib/app-params';
import { persistentStorage } from '@/lib/persistentStorage';

const TOKEN_STORAGE_KEY = 'base44_access_token';
const NATIVE_AUTH_CALLBACK_URL = 'restorebraine://auth';

export const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const getAuthReturnUrl = () => (isNativeApp() ? NATIVE_AUTH_CALLBACK_URL : window.location.href);

export const buildLoginUrl = () => {
  const baseUrl = appParams.serverUrl || BASE44_SERVER_URL;
  const params = new URLSearchParams({
    from_url: getAuthReturnUrl(),
    app_id: appParams.appId,
    prompt: 'select_account',
  });

  return `${baseUrl}/login?${params.toString()}`;
};

const readTokenFromUrl = (url) => {
  const parsedUrl = new URL(url);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  return (
    parsedUrl.searchParams.get('access_token') ||
    parsedUrl.searchParams.get('token') ||
    hashParams.get('access_token') ||
    hashParams.get('token')
  );
};

export const persistAuthTokenFromUrl = async (url) => {
  const token = readTokenFromUrl(url);
  if (!token) return false;

  localStorage.removeItem('b44_signed_out');
  localStorage.removeItem('base44_logged_out');
  await persistentStorage.set(TOKEN_STORAGE_KEY, token);
  await persistentStorage.set('token', token);
  appParams.token = token;
  return true;
};

export const openLogin = async () => {
  const loginUrl = buildLoginUrl();

  if (isNativeApp()) {
    await Browser.open({ url: loginUrl, presentationStyle: 'fullscreen' });
    return;
  }

  window.location.href = loginUrl;
};

export const setupNativeAuthCallback = async (onAuthenticated) => {
  if (!isNativeApp()) return undefined;

  return CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url?.startsWith(NATIVE_AUTH_CALLBACK_URL)) return;

    const didPersistToken = await persistAuthTokenFromUrl(url);
    await Browser.close().catch(() => {});

    if (didPersistToken) {
      onAuthenticated?.();
    }
  });
};
