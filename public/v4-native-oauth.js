/**
 * Native bundled shell — OAuth helpers only. Login UI is React SignInScreen (src/screens/).
 * No duplicate login HTML — Capacitor loads the same dist/ as web via cap-merge-web-into-ios.
 */
(function () {
  var APP_ID = '68fdc5f42768c4d045fe1bac';

  function isBundledShell() {
    try {
      var proto = location.protocol;
      var host = location.hostname;
      return proto === 'capacitor:' || proto === 'ionic:' || host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  function isHostedWrongOrigin() {
    try {
      var host = location.hostname;
      return /base44\.app$/i.test(host) || /restorebraine\.com$/i.test(host);
    } catch (e) {
      return false;
    }
  }

  if (!isBundledShell()) return;

  if (isHostedWrongOrigin()) {
    var stamp =
      (document.querySelector('meta[name="restorebraine-build-stamp"]') || {}).content || 'unknown';
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#fef2f2;">' +
      '<div style="max-width:380px;background:#fff;border-radius:20px;padding:28px 24px;text-align:center;">' +
      '<h1 style="margin:0 0 12px;font-size:20px;color:#111;">Wrong app mode</h1>' +
      '<p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.5;">WebView is on <strong>' +
      location.origin +
      '</strong>, not <code>capacitor://localhost</code>.</p>' +
      '<p style="margin:0 0 12px;font-size:12px;color:#666;">Build: ' +
      stamp +
      '</p>' +
      '<p style="margin:0;font-size:13px;color:#666;">Run:<br><code style="display:block;margin-top:8px;padding:10px;background:#f3f4f6;border-radius:8px;font-size:11px;">bash scripts/mac-capacitor-web-sync.sh</code></p>' +
      '</div></div>';
    return;
  }

  function persistToken(token) {
    if (!token) return;
    try {
      localStorage.removeItem('b44_signed_out');
      localStorage.setItem('base44_access_token', token);
      localStorage.setItem('token', token);
    } catch (e) {}
    try {
      var prefs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
      if (prefs) {
        prefs.remove({ key: 'b44_signed_out' });
        prefs.set({ key: 'base44_access_token', value: token });
        prefs.set({ key: 'token', value: token });
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: token } }));
    window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
  }

  try {
    var params = new URLSearchParams(location.search);
    var urlToken = params.get('access_token');
    if (urlToken) {
      persistToken(urlToken);
      params.delete('access_token');
      var clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
      history.replaceState({}, document.title, clean);
    }
  } catch (e) {}

  window.__restorebraineNativeOAuth = {
    appId: APP_ID,
    persistToken: persistToken,
  };

  function openProviderFromBackup(provider) {
    try {
      if (window.__restorebraineOAuthInProgress) return;
      var fn = window.__restorebraineOpenProviderLogin;
      if (typeof fn === 'function') {
        fn(provider);
        return;
      }
      var openLogin = window.__restorebraineOpenLogin;
      if (typeof openLogin === 'function' && provider === 'google') {
        openLogin();
      }
    } catch (e) {}
  }

  if (!window.__restorebraineNativeOAuthTapBackup) {
    window.__restorebraineNativeOAuthTapBackup = true;
    document.addEventListener(
      'click',
      function (event) {
        var target = event.target && event.target.closest
          ? event.target.closest('[data-rb-provider]')
          : null;
        if (!target) return;
        var provider = target.getAttribute('data-rb-provider');
        if (!provider) return;
        openProviderFromBackup(provider);
      },
      true
    );
  }
})();
