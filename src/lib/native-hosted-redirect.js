import { DEFAULT_APP_ORIGIN, getAppOrigin, isAppHost } from './app-domains';
import { LOCAL_NATIVE_BUNDLE } from './native-bundle-mode';
import { Capacitor } from '@capacitor/core';

export const HOSTED_APP_URL = DEFAULT_APP_ORIGIN;

export const isNativeShell = () => {
  try {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    const { protocol, hostname } = window.location;
    if (protocol === 'capacitor:' || protocol === 'ionic:') return true;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && window.Capacitor) return true;
    return false;
  } catch {
    return false;
  }
};

/** Where the Capacitor WebView should land after OAuth — NOT always the hosted URL. */
export const getNativeWebViewHome = () => {
  if (typeof window === 'undefined') return DEFAULT_APP_ORIGIN;
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${window.location.origin}/`;
  if (LOCAL_NATIVE_BUNDLE) return `${window.location.origin}/`;
  if (isNativeShell()) return DEFAULT_APP_ORIGIN;
  return getAppOrigin();
};

export const isHostedAppOrigin = () => {
  try {
    if (typeof window === 'undefined') return false;
    const { protocol, hostname } = window.location;
    // Bundled native app (capacitor://localhost or https://localhost) is NOT the live hosted site.
    if (protocol === 'capacitor:' || protocol === 'ionic:') return false;
    if (LOCAL_NATIVE_BUNDLE) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    return isAppHost(hostname);
  } catch {
    return false;
  }
};

/** Native installs should always use the live hosted app — same UI/login as kbrown9000@aol.com */
export const redirectNativeToHostedApp = () => {
  if (LOCAL_NATIVE_BUNDLE) return false;
  if (!isNativeShell() || isHostedAppOrigin()) return false;
  // Bundled native-local loads https://localhost — never redirect to hosted URL.
  const hostname = window.location?.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;

  const suffix = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = suffix && suffix !== '/' ? `${HOSTED_APP_URL}${suffix}` : HOSTED_APP_URL;
  window.location.replace(target);
  return true;
};
