import { getGoogleOAuthUrl } from '@/lib/auth-urls';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';

/**
 * One sign-in path for web + hosted native WebView + bundled native.
 * Web and hosted native use the same redirect as Safari.
 * Bundled native (capacitor://localhost) uses InAppBrowser / native plugin.
 */
export async function signInWithGoogle({ clearSignedOut = false } = {}) {
  if (clearSignedOut) {
    try {
      localStorage.removeItem('b44_signed_out');
    } catch {
      /* ignore */
    }
  }

  const oauthUrl = getGoogleOAuthUrl();
  const useWebRedirect =
    !isNativeShell() ||
    isHostedAppOrigin() ||
    !LOCAL_NATIVE_BUNDLE;

  if (useWebRedirect) {
    window.location.assign(oauthUrl);
    return;
  }

  await openLoginInSystemBrowser(oauthUrl, 'google');
}
