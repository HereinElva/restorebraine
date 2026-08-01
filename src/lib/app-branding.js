/** Branded app logo — bundled AppIcon on native, remote PNG on web. */

export const RESTOREBRAINE_APP_LOGO_URL =
  'https://media.base44.com/images/public/68fdc5f42768c4d045fe1bac/e76571efc_appstore.png';

const resolveBundledLogoUrl = (filename) => {
  try {
    return new URL(filename, window.location.href).href;
  } catch {
    return `./${filename}`;
  }
};

const isNativeRuntime = () => {
  try {
    return (
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:'
    );
  } catch {
    return false;
  }
};

export const getRestorebraineAppLogo = () => {
  if (typeof window === 'undefined') return RESTOREBRAINE_APP_LOGO_URL;
  if (isNativeRuntime()) return resolveBundledLogoUrl('AppIcon.png');
  return RESTOREBRAINE_APP_LOGO_URL;
};

/** @deprecated prefer getRestorebraineAppLogo() */
export const RESTOREBRAINE_APP_LOGO = RESTOREBRAINE_APP_LOGO_URL;
