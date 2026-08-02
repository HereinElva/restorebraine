import { DEFAULT_APP_ORIGIN, isAppHost } from './app-domains';

export const HOSTED_APP_URL = DEFAULT_APP_ORIGIN;

export const isNativeShell = () => {
  try {
    return typeof window !== 'undefined' && (
      window.__restorebraineSessionBridgeInstalled ||
      typeof window.__restorebraineOpenLogin === 'function' ||
      typeof window.__RESTOREBRAINE_NATIVE_BUILD__ !== 'undefined' ||
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:'
    );
  } catch {
    return false;
  }
};

export const isHostedAppOrigin = () => {
  try {
    return typeof window !== 'undefined' && isAppHost(window.location.hostname);
  } catch {
    return false;
  }
};

/** Bundled UI in ios/public (capacitor://) — not hosted CDN in WebView. */
export const isBundledCapacitorShell = () => {
  try {
    if (typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== 'undefined' && __RESTOREBRAINE_NATIVE_LOCAL__) {
      return true;
    }
    if (typeof window === 'undefined') return false;
    const protocol = window.location?.protocol;
    if (protocol === 'capacitor:' || protocol === 'ionic:') return true;
    return Boolean(window.__restorebraineMinimalBridge);
  } catch {
    return false;
  }
};

const useLocalNativeBundle = () => isBundledCapacitorShell();

/** Native installs load the hosted app unless built with NATIVE_LOCAL=1 (bundled UI in Xcode). */
export const redirectNativeToHostedApp = () => {
  if (!isNativeShell() || isHostedAppOrigin()) return false;
  // Bundled capacitor:// must never redirect to hosted CDN (causes white screen / no-change loop)
  try {
    if (window.location?.protocol === 'capacitor:' || window.location?.protocol === 'ionic:') {
      return false;
    }
  } catch {}
  if (useLocalNativeBundle()) return false;

  const suffix = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = suffix && suffix !== '/' ? `${HOSTED_APP_URL}${suffix}` : HOSTED_APP_URL;
  window.location.replace(target);
  return true;
};
