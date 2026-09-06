/** Hosted native — bust stale WKWebView cache; show what origin/bundle is running. */
(function rbHostedRuntimeGuard() {
  if (typeof window === 'undefined') return;
  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  var host = location.hostname || '';
  if (host !== 'restorebraine.base44.app' && host !== 'restorebraine.com' && host !== 'www.restorebraine.com') {
    return;
  }

  var EXPECT_DEPLOY = 'v295';
  var RELOAD_KEY = 'restorebraine_hosted_hard_reload';

  function deployMeta() {
    var m = document.querySelector('meta[name="restorebraine-deploy"]');
    return (m && m.getAttribute('content')) || '';
  }

  function moduleSrc() {
    var s = document.querySelector('script[type="module"]');
    return (s && s.getAttribute('src')) || '';
  }

  function paintOverlay() {
    if (document.getElementById('rb-hosted-runtime-overlay')) return;
    var el = document.createElement('div');
    el.id = 'rb-hosted-runtime-overlay';
    el.setAttribute('data-rb-runtime-overlay', '1');
    el.style.cssText =
      'position:fixed;left:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:2147483646;' +
      'max-width:92vw;padding:6px 10px;border-radius:10px;background:rgba(17,24,39,0.88);color:#fff;' +
      'font:11px/1.35 ui-monospace,Menlo,monospace;pointer-events:auto;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    var dm = deployMeta() || '?';
    var mod = moduleSrc() || '?';
    var native = window.__RESTOREBRAINE_NATIVE_BUILD__ || 'native?';
    el.innerHTML =
      '<div><strong>hosted</strong> ' + location.origin + '</div>' +
      '<div>deploy ' + dm + ' · js ' + mod + '</div>' +
      '<div>native ' + native + '</div>' +
      '<button type="button" id="rb-hosted-hard-reload" style="margin-top:6px;padding:4px 8px;border:0;border-radius:6px;background:#7c3aed;color:#fff;font-weight:600">Hard reload</button>';
    document.documentElement.appendChild(el);
    var btn = document.getElementById('rb-hosted-hard-reload');
    if (btn) {
      btn.addEventListener('click', function () {
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch (e) {}
        location.reload(true);
      });
    }
  }

  function maybeHardReloadForStaleDeploy() {
    var dm = deployMeta();
    if (!dm || dm === EXPECT_DEPLOY) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === dm) return;
      sessionStorage.setItem(RELOAD_KEY, dm);
    } catch (e) {
      return;
    }
    location.reload(true);
  }

  function boot() {
    paintOverlay();
    maybeHardReloadForStaleDeploy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
})();
