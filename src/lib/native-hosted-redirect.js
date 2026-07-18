import { DEFAULT_APP_ORIGIN, isAppHost } from './app-domains';

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
    return typeof window !== 'undefined' && isAppHost(window.location.hostname);
  } catch {
    return false;
  }
};

const useLocalNativeBundle = () => {
  try {
    return typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== 'undefined' && __RESTOREBRAINE_NATIVE_LOCAL__;
  } catch {
    return false;
  }
};

/** Native installs load the hosted app unless built with NATIVE_LOCAL=1 (bundled UI in Xcode). */
export const redirectNativeToHostedApp = () => {
  if (!isNativeShell() || isHostedAppOrigin()) return false;
  if (useLocalNativeBundle()) return false;

  const suffix = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = suffix && suffix !== '/' ? `${HOSTED_APP_URL}${suffix}` : HOSTED_APP_URL;
  window.location.replace(target);
  return true;
};
