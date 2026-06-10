import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAppScopedLoginUrl } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl } from '@/lib/native-platform-guard';
export { getAuthReturnOrigin } from '@/lib/app-domains';
export const getRestorebraineLoginUrl = getAppScopedLoginUrl;

/** Open Restorebraine app-scoped login — never the Base44 platform dashboard. */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  const url = getAppScopedLoginUrl();

  if (isNativeShell()) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(url);
    });
    return;
  }

  window.location.href = url;
};
