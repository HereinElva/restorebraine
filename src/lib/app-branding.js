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

/** Native login card: embedded PNG first (never wait for Capacitor), then bundled files, then remote. */
export const getRestorebraineAppLogo = () => {
  if (LOGIN_LOGO_DATA_URL) return LOGIN_LOGO_DATA_URL;
  if (typeof window === 'undefined') return RESTOREBRAINE_APP_LOGO_URL;
  if (isNativeRuntime()) return resolveBundledLogoUrl(bundledLogoNames[0]);
  return RESTOREBRAINE_APP_LOGO_URL;
};

export const getRestorebraineAppLogoFallbacks = () => {
  const sources = [];
  if (LOGIN_LOGO_DATA_URL) sources.push(LOGIN_LOGO_DATA_URL);
  if (typeof window !== 'undefined' && isNativeRuntime()) {
    sources.push(...bundledLogoNames.map(resolveBundledLogoUrl));
  }
  if (typeof window !== 'undefined') {
    sources.push(RESTOREBRAINE_APP_LOGO_URL);
  } else if (!sources.length) {
    sources.push(RESTOREBRAINE_APP_LOGO_URL);
  }
  return sources;
};

/** @deprecated prefer getRestorebraineAppLogo() */
export const RESTOREBRAINE_APP_LOGO = RESTOREBRAINE_APP_LOGO_URL;
