/**
 * app-params.js
 *
 * Reads app configuration from URL params or persistent storage.
 * Uses Capacitor Preferences (native) when available so the auth token
 * survives app closes and relaunches. Falls back to localStorage in browser.
 */

import { persistentStorage } from './persistentStorage';
import { DEFAULT_APP_ORIGIN, getAppOrigin } from './app-domains';

const isNode = typeof window === 'undefined';

const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

const STORAGE_PREFIX = 'base44_';

export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const BASE44_API_URL = 'https://base44.app';
export { getAppOrigin, getAppOrigin as getRestorebraineAppUrl, getAuthReturnOrigin, DEFAULT_APP_ORIGIN, isAppHost } from './app-domains';
/** Resolved once at module load in the browser — prefer getAppOrigin() for dynamic reads. */
export const RESTOREBRAINE_APP_URL = isNode ? DEFAULT_APP_ORIGIN : getAppOrigin();

const getAppParamValueSync = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) return defaultValue;

  if (paramName === 'app_id') return BASE44_APP_ID;
  if (paramName === 'server_url') return BASE44_API_URL;

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

  if (defaultValue) {
    return defaultValue;
  }

  if (paramName === "access_token" && localStorage.getItem("base44_logged_out") === "true") return null;
  return persistentStorage.getSync(storageKey);
};

const getAppParams = () => {
  return {
    appId: getAppParamValueSync('app_id', { defaultValue: BASE44_APP_ID }),
    serverUrl: getAppParamValueSync('server_url', { defaultValue: BASE44_API_URL }),
    token: getAppParamValueSync('access_token', { removeFromUrl: true }),
    fromUrl: getAppParamValueSync('from_url', { defaultValue: isNode ? '' : window.location.href }),
    functionsVersion: getAppParamValueSync('functions_version'),
  };
};

export const appParams = {
  ...getAppParams(),
};

export const clearPersistedToken = async () => {
  appParams.token = null;
  await persistentStorage.remove(`${STORAGE_PREFIX}access_token`);
  await persistentStorage.remove('token');
};
