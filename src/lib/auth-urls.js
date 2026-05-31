import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAppScopedLoginUrl, getCanonicalOAuthUrl } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl } from '@/lib/native-platform-guard';
export const getRestorebraineLoginUrl = getAppScopedLoginUrl;

/** Open login — native goes straight to OAuth (never the Base44 /login page). */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  if (isNativeShell()) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
    });
    return;
  }

  window.location.href = getAppScopedLoginUrl();
};
