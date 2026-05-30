/** Keep OAuth in the main WebView — Capacitor iOS opens popups in Safari by default. */
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
};
