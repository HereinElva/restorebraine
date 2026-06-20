/** Branded app logo — embedded data URL on native (never fails WKWebView load). */
import { LOGIN_LOGO_DATA_URL } from '@/lib/login-logo-data';

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

/** Native login card: embedded PNG first, then bundled files, then remote. */
export const getRestorebraineAppLogo = () => {
  if (typeof window === 'undefined') return RESTOREBRAINE_APP_LOGO_URL;
  if (isNativeRuntime() && LOGIN_LOGO_DATA_URL) return LOGIN_LOGO_DATA_URL;
  if (isNativeRuntime()) return resolveBundledLogoUrl(bundledLogoNames[0]);
  return RESTOREBRAINE_APP_LOGO_URL;
};

export const getRestorebraineAppLogoFallbacks = () => {
  if (typeof window === 'undefined') return [RESTOREBRAINE_APP_LOGO_URL];
  if (isNativeRuntime()) {
    const sources = [];
    if (LOGIN_LOGO_DATA_URL) sources.push(LOGIN_LOGO_DATA_URL);
    sources.push(...bundledLogoNames.map(resolveBundledLogoUrl));
    return sources;
  }
  return [RESTOREBRAINE_APP_LOGO_URL];
};

/** @deprecated prefer getRestorebraineAppLogo() */
export const RESTOREBRAINE_APP_LOGO = RESTOREBRAINE_APP_LOGO_URL;
