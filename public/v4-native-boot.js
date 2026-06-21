/**
 * Native v4 preboot — sign-in shell before React, Google OAuth via native plugin or InAppBrowser.
 */
(function () {
  var APP_ID = '68fdc5f42768c4d045fe1bac';
  var FROM_URL = 'https://restorebraine.base44.app';
  var GOOGLE_OAUTH =
    'https://app.base44.com/api/apps/auth/login?app_id=' +
    APP_ID +
    '&from_url=' +
    encodeURIComponent(FROM_URL) +
    '&prompt=select_account';

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

  function showWrongOriginScreen() {
    var stamp =
      (document.querySelector('meta[name="restorebraine-build-stamp"]') || {}).content || 'unknown build';
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#fef2f2;">' +
      '<div style="max-width:380px;background:#fff;border-radius:20px;padding:28px 24px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.12);">' +
      '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#b91c1c;">Wrong app mode</p>' +
      '<h1 style="margin:0 0 12px;font-size:20px;color:#111;">Hosted login loaded</h1>' +
      '<p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.5;">WebView is on <strong>' +
      location.origin +
      '</strong>, not <code>capacitor://localhost</code>.</p>' +
      '<p style="margin:0 0 16px;font-size:12px;color:#666;">Build: ' +
      stamp +
      '</p>' +
      '<p style="margin:0;font-size:13px;color:#666;text-align:left;">On Mac run:<br><code style="display:block;margin-top:8px;padding:10px;background:#f3f4f6;border-radius:8px;font-size:11px;word-break:break-all;">bash scripts/mac-ios-v4-deploy.sh --sync</code></p>' +
      '</div></div>';
  }

  if (!isBundledShell() && isHostedWrongOrigin()) {
    showWrongOriginScreen();
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
    location.replace(location.origin + '/');
  }

  function tryNativePluginOAuth() {
    try {
      var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RestorebraineOAuth;
      if (!plugin || !plugin.startGoogleOAuth) return false;
      window.__restorebraineOAuthMode = 'v4-native-preboot';
      window.__restorebraineLastOAuthUrl = GOOGLE_OAUTH;
      plugin
        .startGoogleOAuth({ url: GOOGLE_OAUTH })
        .then(function (result) {
          if (result && result.token) persistToken(result.token);
        })
        .catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  function wireGoogleButton() {
    var button = document.getElementById('restorebraine-google-btn');
    if (!button || button.__rbSignInWired) return;
    button.__rbSignInWired = true;

    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = 'Opening sign in…';
      try {
        localStorage.removeItem('b44_signed_out');
      } catch (e) {}
      if (tryNativePluginOAuth()) return;

      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        if (tryNativePluginOAuth()) {
          clearInterval(timer);
          return;
        }
        if (attempts >= 60) {
          clearInterval(timer);
          button.disabled = false;
          button.textContent = 'Continue with Google';
          alert('Could not open sign in. Delete app, run mac-ios-v4-deploy.sh --sync, Xcode Run.');
        }
      }, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGoogleButton);
  } else {
    wireGoogleButton();
  }

  function showBuildTag() {
    var tag = document.getElementById('rb-signin-build-tag');
    if (!tag) return;
    var stamp =
      (document.querySelector('meta[name="restorebraine-build-stamp"]') || {}).content ||
      (document.querySelector('meta[name="restorebraine-deploy"]') || {}).content ||
      '';
    var version = (stamp.match(/v(\d+)/) || [])[1];
    tag.textContent = version ? 'Bundled app · build v' + version : 'Bundled app · v4-core';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBuildTag);
  } else {
    showBuildTag();
  }
})();
