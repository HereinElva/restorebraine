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

/** After OAuth or blocked navigation, reload the correct app home (local bundle or hosted). */
export const reloadNativeAppHome = () => {
  if (typeof window === 'undefined') return;
  const target = isHostedAppOrigin()
    ? `${HOSTED_APP_URL}/`
    : `${window.location.origin}/`;
  window.location.replace(target);
};

/** Native app loads the bundled UI — do not redirect to the hosted Base44 site. */
export const redirectNativeToHostedApp = () => false;
