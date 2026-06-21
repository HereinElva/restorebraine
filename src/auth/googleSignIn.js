import { getGoogleOAuthUrl } from '@/lib/auth-urls';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';
import { isNativeShell } from '@/lib/native-hosted-redirect';

/** Start Google OAuth — direct API login, never Base44 multi-provider page. */
export async function startGoogleSignIn({ clearSignedOut = false } = {}) {
  if (clearSignedOut) {
    try {
      localStorage.removeItem('b44_signed_out');
    } catch {
      /* ignore storage errors */
    }
  }

  const oauthUrl = getGoogleOAuthUrl();
  if (isNativeShell()) {
    await openLoginInSystemBrowser(oauthUrl, 'google');
    return;
  }

  window.location.href = oauthUrl;
}
