/**
 * Web login boot — shows Restorebraine login card before React mounts.
 * Wires Continue with Google to direct OAuth (not app.base44.com/login).
 */
(function () {
  var APP_ID = '68fdc5f42768c4d045fe1bac';
  var FROM_URL = location.protocol + '//' + location.host;
  var GOOGLE_OAUTH =
    'https://app.base44.com/api/apps/auth/login?app_id=' +
    APP_ID +
    '&from_url=' +
    encodeURIComponent(FROM_URL) +
    '&prompt=select_account';

  function isBundledNative() {
    try {
      var proto = location.protocol;
      var host = location.hostname;
      return proto === 'capacitor:' || proto === 'ionic:' || host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  if (isBundledNative()) return;

  function wireLoginButton() {
    var btn = document.getElementById('rb-web-google-btn');
    if (!btn || btn.__restorebraineWired) return;
    btn.__restorebraineWired = true;
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Opening sign in…';
      try {
        localStorage.removeItem('b44_signed_out');
      } catch (e) {}
      location.href = GOOGLE_OAUTH;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireLoginButton);
  } else {
    wireLoginButton();
  }
})();
