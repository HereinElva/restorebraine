import { createClient } from '@base44/sdk';
import { appParams, getAppOrigin } from '@/lib/app-params';
import { getGoogleOAuthUrl, openRestorebraineLogin } from '@/lib/auth-urls';
import { isNativeShell, isHostedAppOrigin } from '@/lib/native-hosted-redirect';

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

// Never send users to app.base44.com/login multi-provider page — direct Google OAuth.
const originalRedirectToLogin = base44.auth.redirectToLogin.bind(base44.auth);
base44.auth.redirectToLogin = (nextUrl) => {
  if (typeof window === 'undefined') {
    return originalRedirectToLogin(nextUrl);
  }
  if (isNativeShell() && !isHostedAppOrigin()) {
    openRestorebraineLogin();
    return;
  }
  window.location.href = getGoogleOAuthUrl();
};
