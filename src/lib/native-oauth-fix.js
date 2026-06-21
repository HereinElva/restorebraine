/** Keep OAuth in the main WebView — Capacitor iOS opens popups in Safari by default. */
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { installNativePlatformGuard } from '@/lib/native-platform-guard';
import { installNativeGoogleOAuthBrowser } from '@/lib/native-google-oauth';

export const captureAccessTokenFromUrl = () => {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (!token) return null;

    localStorage.setItem('base44_access_token', token);
    localStorage.setItem('token', token);
    try {
      localStorage.removeItem('b44_signed_out');
    } catch {
      /* ignore */
    }
    params.delete('access_token');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
    return token;
  } catch (error) {
    console.warn('Failed to capture OAuth token from URL', error);
    return null;
  }
};

export const installNativeOAuthFix = () => {
  if (typeof window === 'undefined' || window.__restorebraineOAuthFixInstalled) return;
  window.__restorebraineOAuthFixInstalled = true;

  captureAccessTokenFromUrl();

  // v4-core: bridge loads from index.html at parse time — never install Location guards here
  // (double-wrapping Location.prototype causes a blank white screen on iOS).
  if (LOCAL_NATIVE_BUNDLE || window.__restorebraineSessionBridgeInstalled) return;

  // Capacitor + hosted Base44 URL: AppDelegate.swift already patches navigation at
  // document start. Installing web guards here double-wraps Location and causes a
  // blank white screen on iOS.
  if (isNativeShell() && !isHostedAppOrigin()) {
    installNativeGoogleOAuthBrowser();
    installNativePlatformGuard();
  }
};
