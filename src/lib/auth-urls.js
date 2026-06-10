import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAuthReturnOrigin } from '@/lib/app-domains';
import { BASE44_APP_ID, BASE44_PLATFORM_URL } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL, getGoogleOAuthUrl } from '@/lib/native-platform-guard';
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

/** Open Restorebraine login — never the broken custom-domain /login route. */
export const openRestorebraineLogin = () => {
  if (typeof window === 'undefined') return;

  const url = getPlatformLoginUrl();

  if (isNativeShell()) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(url);
    });
    return;
  }

  window.location.href = url;
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
