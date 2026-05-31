import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAppScopedLoginUrl, getGoogleOAuthUrl } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl } from '@/lib/native-platform-guard';
export const getRestorebraineLoginUrl = getAppScopedLoginUrl;

/** Open Restorebraine OAuth login — never the Base44 platform /login dashboard. */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  if (isNativeShell()) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
    });
    return;
  }

  window.location.href = getAppScopedLoginUrl();
};
