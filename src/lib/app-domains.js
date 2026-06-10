/** Default hosted URL — also used by native Capacitor shell. */
export const DEFAULT_APP_ORIGIN = 'https://restorebraine.base44.app';

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

/** OAuth redirect target — native shell always uses the default hosted URL. */
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
