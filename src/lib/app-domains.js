import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';

/** Default hosted URL — also used by native Capacitor shell. */
export const DEFAULT_APP_ORIGIN = 'https://restorebraine.base44.app';

/** Registered in Info.plist — OAuth redirect opens the app with access_token. */
export const NATIVE_OAUTH_RETURN_URL = 'restorebraine://oauth/callback';

export const APP_HOSTS = new Set([
  'restorebraine.base44.app',
  'restorebraine.com',
  'www.restorebraine.com',
  'localhost',
]);

export function isAppHost(hostname = '') {
  return APP_HOSTS.has(String(hostname).toLowerCase());
}

/** Current app origin in the browser, or the default hosted URL on native/server. */
export function getAppOrigin() {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, host } = window.location;
    if (isAppHost(hostname)) {
      return `${protocol}//${host}`;
    }
  }
  return DEFAULT_APP_ORIGIN;
}

/** OAuth from_url sent to Base44 — must be HTTPS whitelisted domain (never restorebraine://). */
export function getOAuthReturnUrl() {
  return DEFAULT_APP_ORIGIN;
}

/** OAuth redirect target — native shell uses hosted URL for API callbacks. */
export function getAuthReturnOrigin() {
  if (typeof window === 'undefined') return DEFAULT_APP_ORIGIN;
  try {
    const isNative =
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:';
    if (isNative) return DEFAULT_APP_ORIGIN;
  } catch {}
  return getAppOrigin();
}
