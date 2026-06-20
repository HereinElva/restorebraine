/** Keep OAuth in the main WebView — Capacitor iOS opens popups in Safari by default. */
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { installNativePlatformGuard } from '@/lib/native-platform-guard';
import { installNativeGoogleOAuthBrowser } from '@/lib/native-google-oauth';
import { installNativeBundleShellGuard } from '@/lib/native-bundle-shell-guard';

export const captureAccessTokenFromUrl = () => {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (!token) return null;

    localStorage.setItem('base44_access_token', token);
    localStorage.setItem('token', token);
    params.delete('access_token');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
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

  // Build v4: AppDelegate injects restorebraine-v4-bridge.js at document start.
  // Do not install duplicate Location/OAuth guards — they conflict with the bridge.
  if (window.__restorebraineSessionBridgeInstalled) return;

  // Capacitor + hosted Base44 URL: AppDelegate.swift already patches navigation at
  // document start. Installing web guards here double-wraps Location and causes a
  // blank white screen on iOS.
  if (isNativeShell() && !isHostedAppOrigin()) {
    installNativeGoogleOAuthBrowser();
    if (LOCAL_NATIVE_BUNDLE) {
      installNativeBundleShellGuard();
    } else {
      installNativePlatformGuard();
    }
  }
};
