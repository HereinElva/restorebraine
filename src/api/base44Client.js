import { createClient } from '@base44/sdk';
import { appParams, getAppOrigin } from '@/lib/app-params';
import { getPlatformLoginUrl } from '@/lib/auth-urls';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  serverUrl,
  appBaseUrl: getAppOrigin(),
  token,
  functionsVersion,
  requiresAuth: false
});

// Custom-domain /login is a broken Base44 platform page — always use app.base44.com.
const originalRedirectToLogin = base44.auth.redirectToLogin.bind(base44.auth);
base44.auth.redirectToLogin = (nextUrl) => {
  if (typeof window === 'undefined') {
    return originalRedirectToLogin(nextUrl);
  }
  const returnTo = nextUrl
    ? new URL(nextUrl, window.location.origin).toString()
    : window.location.href;
  window.location.href = getPlatformLoginUrl(returnTo);
};
