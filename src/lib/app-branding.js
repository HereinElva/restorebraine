/** Branded app logo — bundled login-logo.png on native (media.base44.com blocked by WKAppBoundDomains). */
export const RESTOREBRAINE_APP_LOGO_URL =
  'https://media.base44.com/images/public/68fdc5f42768c4d045fe1bac/e76571efc_appstore.png';

const bundledLogoNames = ['login-logo.png', 'AppIcon.png'];

const resolveBundledLogoUrl = (filename) => {
  try {
    return new URL(filename, window.location.href).href;
  } catch {
    return `./${filename}`;
  }
};

/** Native login card: prefer small bundled PNG (128px), then full AppIcon. */
export const getRestorebraineAppLogo = () => {
  if (typeof window === 'undefined') return RESTOREBRAINE_APP_LOGO_URL;
  try {
    const isNative =
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:';
    if (isNative) return resolveBundledLogoUrl(bundledLogoNames[0]);
  } catch {}
  return RESTOREBRAINE_APP_LOGO_URL;
};

export const getRestorebraineAppLogoFallbacks = () => {
  if (typeof window === 'undefined') return [RESTOREBRAINE_APP_LOGO_URL];
  try {
    const isNative =
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:';
    if (isNative) return bundledLogoNames.map(resolveBundledLogoUrl);
  } catch {}
  return [RESTOREBRAINE_APP_LOGO_URL];
};

/** @deprecated prefer getRestorebraineAppLogo() */
export const RESTOREBRAINE_APP_LOGO = RESTOREBRAINE_APP_LOGO_URL;
