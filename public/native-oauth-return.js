/** Redirect OAuth token from hosted callback into the native app deep link. */
(function () {
  if (typeof window === 'undefined') return;
  var proto = location.protocol;
  if (proto === 'capacitor:' || proto === 'ionic:') return;
  if (location.hostname !== 'restorebraine.base44.app') return;
  var token = new URLSearchParams(location.search).get('access_token');
  if (!token) return;
  location.replace('restorebraine://oauth/callback?access_token=' + encodeURIComponent(token));
})();
