/** Keep OAuth in the main WebView — Capacitor iOS opens popups in Safari by default. */
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { installNativePlatformGuard } from '@/lib/native-platform-guard';

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

  const originalOpen = window.open;
  window.open = function openInSameWindow(url, target, features) {
    if (typeof url === 'string' && url.length > 0) {
      window.location.assign(url);
      return window;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };

  captureAccessTokenFromUrl();

  if (isNativeShell()) {
    installNativePlatformGuard();
  }
};
