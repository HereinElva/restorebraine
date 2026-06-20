/** Branded app logo — bundled /AppIcon.png on native (media.base44.com blocked by WKAppBoundDomains). */
export const RESTOREBRAINE_APP_LOGO_URL =
  'https://media.base44.com/images/public/68fdc5f42768c4d045fe1bac/e76571efc_appstore.png';

export const getRestorebraineAppLogo = () => {
  if (typeof window === 'undefined') return RESTOREBRAINE_APP_LOGO_URL;
  try {
    const isNative =
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:';
    if (isNative) return './AppIcon.png';
  } catch {}
  return RESTOREBRAINE_APP_LOGO_URL;
};

/** @deprecated prefer getRestorebraineAppLogo() */
export const RESTOREBRAINE_APP_LOGO = RESTOREBRAINE_APP_LOGO_URL;
