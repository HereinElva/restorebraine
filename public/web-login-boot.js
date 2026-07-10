/**
 * Web preboot — wires Continue with Google before React mounts.
 * Skipped on capacitor://localhost (native uses v4-native-boot.js after build stamp).
 */
(function () {
  var APP_ID = '68fdc5f42768c4d045fe1bac';

  function isBundledNativeShell() {
    try {
      var proto = location.protocol;
      var host = location.hostname;
      return proto === 'capacitor:' || proto === 'ionic:' || host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
      return false;
    }
  }

  if (isBundledNativeShell()) return;

  function buildOAuthUrl() {
    var fromUrl = location.protocol + '//' + location.host;
    var params = 'app_id=' + APP_ID + '&from_url=' + encodeURIComponent(fromUrl) + '&prompt=select_account';
    return 'https://app.base44.com/api/apps/auth/login?' + params;
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
      location.href = buildOAuthUrl();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireGoogleButton);
  } else {
    wireGoogleButton();
  }
})();
