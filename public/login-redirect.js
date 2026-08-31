/** Runs before the React app — fixes broken Base44 login redirects on custom domains. */
(function () {
  var proto = location.protocol;
  var host = location.hostname;
  // v4-core bundled shell: never patch Location — breaks React Router (white screen).
  if (proto === 'capacitor:' || proto === 'ionic:' || host === 'localhost' || host === '127.0.0.1') return;

  var APP_ID = '68fdc5f42768c4d045fe1bac';
  var PLATFORM = 'https://app.base44.com';
  var APP_ORIGIN = location.protocol + '//' + location.host;
  var path = location.pathname.replace(/\/$/, '') || '/';

  /** Direct Google OAuth — never app.base44.com/login multi-provider page. */
  function googleOAuth(fromUrl) {
    var params = new URLSearchParams({
      app_id: APP_ID,
      from_url: fromUrl || 'https://restorebraine.com',
      prompt: 'select_account',
    });
    location.replace(PLATFORM + '/api/apps/auth/login?' + params.toString());
  }

  if (host === 'base44.app' && path === '/login') {
    googleOAuth('https://restorebraine.com');
    return;
  }

  if ((host === 'restorebraine.com' || host === 'www.restorebraine.com') && path === '/login') {
    googleOAuth(APP_ORIGIN);
    return;
  }

  var originalAssign = Location.prototype.assign;
  var originalReplace = Location.prototype.replace;

  function guard(url) {
    var value = String(url || '');
    if (/^https:\/\/base44\.app\/login/i.test(value)) {
      googleOAuth('https://restorebraine.com');
      return true;
    }
    if (/^https:\/\/restorebraine\.com\/login/i.test(value) || /^https:\/\/www\.restorebraine\.com\/login/i.test(value)) {
      googleOAuth('https://restorebraine.com');
      return true;
    }
    return false;
  }

  Location.prototype.assign = function (url) {
    if (guard(url)) return;
    return originalAssign.call(this, url);
  };

  Location.prototype.replace = function (url) {
    if (guard(url)) return;
    return originalReplace.call(this, url);
  };
})();
