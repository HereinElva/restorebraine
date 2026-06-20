import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAuthReturnOrigin } from '@/lib/app-domains';
import { BASE44_APP_ID, BASE44_PLATFORM_URL, getGoogleOAuthUrl, getProviderOAuthUrl } from '@/lib/native-platform-guard';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl, getCanonicalOAuthUrl } from '@/lib/native-platform-guard';
export { getAuthReturnOrigin } from '@/lib/app-domains';

/**
 * Base44 platform login — always app.base44.com, never {origin}/login.
 * Custom domains serve a broken platform /login page that redirects to
 * base44.app/login and returns "App not found".
 */
export const getPlatformLoginUrl = (fromUrl) => {
  const params = new URLSearchParams({
    from_url: fromUrl || getAuthReturnOrigin(),
    app_id: BASE44_APP_ID,
    prompt: 'select_account',
  });
  return `${BASE44_PLATFORM_URL}/login?${params.toString()}`;
};

export const getRestorebraineLoginUrl = getPlatformLoginUrl;

/**
 * Open OAuth for a provider (Google / Apple / Microsoft) in Capacitor system browser.
 * SignInScreen / navigateToLogin calls this when user taps Continue with Google.
 */
export const openNativeProviderLogin = (provider = 'google') => {
  if (typeof window === 'undefined') return;
  const url = provider === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(provider);
  openLoginInSystemBrowser(url, provider);
};

/**
 * Build v4 native: tap Continue with Google → direct OAuth in InAppBrowser.
 * Web / hosted: platform login page.
 */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  if (isNativeShell()) {
    openNativeProviderLogin('google');
    return;
  }

  window.location.href = getPlatformLoginUrl();
};

/** If the user lands on /login on a custom domain, escape the broken platform page. */
export const redirectBrokenCustomDomainLogin = () => {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname, search } = window.location;
  if (pathname.replace(/\/$/, '') !== '/login') return false;
  if (hostname === 'restorebraine.base44.app' || hostname === 'localhost') return false;

  const params = new URLSearchParams(search);
  if (!params.get('app_id')) params.set('app_id', BASE44_APP_ID);
  if (!params.get('from_url')) params.set('from_url', getAuthReturnOrigin());
  if (!params.get('prompt')) params.set('prompt', 'select_account');

  window.location.replace(`${BASE44_PLATFORM_URL}/login?${params.toString()}`);
  return true;
};
