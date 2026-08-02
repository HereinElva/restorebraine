/** Keep OAuth in the main WebView — Capacitor iOS opens popups in Safari by default. */
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { installNativePlatformGuard } from '@/lib/native-platform-guard';
import { installNativeGoogleOAuthBrowser } from '@/lib/native-google-oauth';

export const captureAccessTokenFromUrl = () => {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (!token) return null;

    try { localStorage.removeItem('b44_signed_out'); } catch {}
    localStorage.setItem('base44_access_token', token);
    localStorage.setItem('token', token);
    params.delete('access_token');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
    try {
      window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
    } catch {}
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

  // Defer guards until React mounts — patching location before module load causes white screen
  const startGuards = () => {
    if (!isNativeShell()) return;
    // Bundled: AppDelegate OAuth bridge handles Sign In — skip Location patches (white screen)
    try {
      if (window.location?.protocol === 'capacitor:' || window.location?.protocol === 'ionic:') {
        if (typeof window.__restorebraineOpenLogin === 'function') return;
      }
    } catch {}
    installNativeGoogleOAuthBrowser();
    try {
      if (window.location?.protocol === 'capacitor:' || window.location?.protocol === 'ionic:') return;
    } catch {}
    installNativePlatformGuard();
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startGuards, 0);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(startGuards, 0), { once: true });
  }
};
