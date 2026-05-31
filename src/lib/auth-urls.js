import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAppScopedLoginUrl, getCanonicalOAuthUrl } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl } from '@/lib/native-platform-guard';
export const getRestorebraineLoginUrl = getAppScopedLoginUrl;

const waitForNativeOpenLogin = (attempt = 0) => {
  if (typeof window !== 'undefined' && window.__restorebraineOpenLogin) {
    window.__restorebraineOpenLogin();
    return;
  }
  if (attempt >= 50) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(getCanonicalOAuthUrl('google'), 'google');
    });
    return;
  }
  setTimeout(() => waitForNativeOpenLogin(attempt + 1), 100);
};

/** Open login — native always uses OAuth in system browser, never the Base44 /login page. */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  if (isNativeShell() || window.__restorebraineSessionBridgeInstalled) {
    waitForNativeOpenLogin();
    return;
  }

  window.location.href = getAppScopedLoginUrl();
};
