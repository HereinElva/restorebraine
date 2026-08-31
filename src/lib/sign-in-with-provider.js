import { getGoogleOAuthUrl, getCanonicalOAuthUrl } from '@/lib/auth-urls';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';

function clearSignedOutFlag(clearSignedOut) {
  if (!clearSignedOut) return;
  try {
    localStorage.removeItem('b44_signed_out');
  } catch {
    /* ignore */
  }
}

function oauthUrlForProvider(provider) {
  if (provider === 'google') return getGoogleOAuthUrl();
  return getCanonicalOAuthUrl(provider);
}

/**
 * OAuth sign-in for google | apple — web, hosted WebView, and bundled native.
 */
export async function signInWithProvider(provider = 'google', { clearSignedOut = false } = {}) {
  clearSignedOutFlag(clearSignedOut);

  const oauthUrl = oauthUrlForProvider(provider);
  const useWebRedirect =
    !isNativeShell() ||
    isHostedAppOrigin() ||
    !LOCAL_NATIVE_BUNDLE;

  if (useWebRedirect) {
    window.location.assign(oauthUrl);
    return;
  }

  await openLoginInSystemBrowser(oauthUrl, provider);
}

export async function signInWithGoogle(options = {}) {
  return signInWithProvider('google', options);
}

export async function signInWithApple(options = {}) {
  return signInWithProvider('apple', options);
}
