/**
 * app-params.js
 *
 * Reads app configuration from URL params or persistent storage.
 * Uses Capacitor Preferences (native) when available so the auth token
 * survives app closes and relaunches. Falls back to localStorage in browser.
 */

import { persistentStorage } from './persistentStorage';

const isNode = typeof window === 'undefined';

const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

const isNativeRuntime = () => {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

const STORAGE_PREFIX = 'base44_';

export const BASE44_APP_ID = '68fdc53372ff0fbf07eee38d';
export const BASE44_SERVER_URL = 'https://app.base44.com';

const getAppParamValueSync = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue;

  const storageKey = `${STORAGE_PREFIX}${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl && searchParam) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    persistentStorage.set(storageKey, searchParam);
    return searchParam;
  }

  if (isNativeRuntime() && paramName === 'server_url') {
    persistentStorage.set(storageKey, BASE44_SERVER_URL);
    return BASE44_SERVER_URL;
  }

  if (defaultValue) {
    persistentStorage.set(storageKey, defaultValue);
    return defaultValue;
  }

  if (paramName === "access_token" && localStorage.getItem("base44_logged_out") === "true") return null;
  if (typeof window !== "undefined" && window.localStorage && window.localStorage.getItem("b44_signed_out") === "1" && paramName === "access_token") return null;
  return persistentStorage.getSync(storageKey);
};

const getAppParams = () => {
  return {
    appId: getAppParamValueSync('app_id', { defaultValue: import.meta.env.VITE_BASE44_APP_ID || BASE44_APP_ID }),
    serverUrl: getAppParamValueSync('server_url', { defaultValue: import.meta.env.VITE_BASE44_BACKEND_URL || BASE44_SERVER_URL }),
    token: getAppParamValueSync('access_token', { removeFromUrl: true }),
    fromUrl: getAppParamValueSync('from_url', { defaultValue: isNode ? '' : window.location.href }),
    functionsVersion: getAppParamValueSync('functions_version'),
  };
};

export const appParams = {
  ...getAppParams(),
};

// On launch, restore token from Capacitor Preferences into localStorage
if (!isNode) {
  const tokenKey = `${STORAGE_PREFIX}access_token`;
  persistentStorage.get(tokenKey).then((storedToken) => {
    if (storedToken && !appParams.token) {
      appParams.token = storedToken;
      persistentStorage._mirror(tokenKey, storedToken);
    }
  });
}

export const clearPersistedToken = async () => {
  const tokenKey = `${STORAGE_PREFIX}access_token`;
  await persistentStorage.remove(tokenKey);
};
