/** Hosted-site bridge: redirect OAuth token back into the native app (publish to Base44). */
(function () {
  if (typeof window === 'undefined') return;
  var proto = location.protocol;
  if (proto === 'capacitor:' || proto === 'ionic:') return;
  var host = location.hostname;
  if (host !== 'restorebraine.base44.app') return;
  var token = new URLSearchParams(location.search).get('access_token');
  if (!token) return;
  location.replace('restorebraine://oauth/callback?access_token=' + encodeURIComponent(token));
})();
