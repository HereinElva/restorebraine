import { DEFAULT_APP_ORIGIN, isAppHost } from './app-domains';
import { LOCAL_NATIVE_BUNDLE } from './native-bundle-mode';

export const HOSTED_APP_URL = DEFAULT_APP_ORIGIN;

export const isNativeShell = () => {
  try {
    return typeof window !== 'undefined' && (
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
  // npm run build:native-local — test bundled code on device without loading Base44
  if (LOCAL_NATIVE_BUNDLE) return false;
  if (!isNativeShell() || isHostedAppOrigin()) return false;

  const suffix = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = suffix && suffix !== '/' ? `${HOSTED_APP_URL}${suffix}` : HOSTED_APP_URL;
  window.location.replace(target);
  return true;
};
