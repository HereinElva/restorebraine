export const HOSTED_APP_URL = 'https://restorebraine.base44.app';

export const isNativeShell = () => {
  try {
    return typeof window !== 'undefined' && (
      window.Capacitor?.isNativePlatform?.() ||
      window.__RESTOREBRAINE_NATIVE_BUILD__ ||
      window.__restorebraineSessionBridgeInstalled ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:'
    );
  } catch {
    return false;
  }
};

export const isHostedAppOrigin = () => {
  try {
    return typeof window !== 'undefined' && window.location.hostname === 'restorebraine.base44.app';
  } catch {
    return false;
  }
};

/** Native installs should always use the live hosted app — same UI/login as kbrown9000@aol.com */
export const redirectNativeToHostedApp = () => {
  if (!isNativeShell() || isHostedAppOrigin()) return false;

  const suffix = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = suffix && suffix !== '/' ? `${HOSTED_APP_URL}${suffix}` : HOSTED_APP_URL;
  window.location.replace(target);
  return true;
};
