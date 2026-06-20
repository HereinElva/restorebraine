/**
 * Build v4 Capacitor session bridge — injected at document start from AppDelegate.
 * Syncs native UserDefaults token into localStorage before React mounts.
 */
(function () {
  if (window.__restorebraineV4BridgeInstalled) return;
  window.__restorebraineV4BridgeInstalled = true;

  var TOKEN_KEYS = ['base44_access_token', 'token'];
  var SIGNED_OUT_KEY = 'b44_signed_out';

  function readToken() {
    try {
      if (localStorage.getItem(SIGNED_OUT_KEY) === '1') return null;
      for (var i = 0; i < TOKEN_KEYS.length; i++) {
        var value = localStorage.getItem(TOKEN_KEYS[i]);
        if (value) return value;
      }
    } catch (e) {}
    return null;
  }

  function saveToken(token) {
    if (!token) return false;
    try {
      localStorage.removeItem(SIGNED_OUT_KEY);
      localStorage.setItem('base44_access_token', token);
      localStorage.setItem('token', token);
      window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: token } }));
      return true;
    } catch (e) {}
    return false;
  }

  function captureFromUrl(url) {
    if (!url) return null;
    try {
      var parsed = new URL(String(url));
      var token = parsed.searchParams.get('access_token');
      if (token) saveToken(token);
      return token;
    } catch (e) {}
    return null;
  }

  // Native injects sync token from UserDefaults before Capacitor Preferences loads.
  var syncToken = window.__RESTOREBRAINE_NATIVE_SYNC_TOKEN__ || '';
  if (syncToken && !readToken()) {
    saveToken(syncToken);
  }

  window.__restorebraineV4SaveToken = saveToken;
  window.__restorebraineV4CaptureOAuthUrl = captureFromUrl;

  window.addEventListener('restorebraine-native-oauth-complete', function () {
    if (syncToken) saveToken(syncToken);
    if (readToken()) {
      window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: readToken() } }));
    }
  });
})();
