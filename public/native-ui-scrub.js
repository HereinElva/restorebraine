/** Runs before React — strips debug badge, stale loading UI, and "Sign in instead". */
(function () {
  function scrub() {
    try {
      var stamp = document.getElementById('rb-native-stamp');
      if (stamp) stamp.remove();
      document.querySelectorAll('[id*="native-stamp"], [class*="native-stamp"]').forEach(function (n) {
        n.remove();
      });
      document.querySelectorAll('button, a, p, span').forEach(function (el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^sign in instead$/i.test(text)) el.remove();
        if (/^v\d+\s*ⓘ$/i.test(text) || /^v\d+\s*i$/i.test(text)) {
          var parent = el.closest('#rb-native-stamp') || el;
          if (parent.id === 'rb-native-stamp' || /native-stamp/i.test(parent.id || '')) parent.remove();
        }
      });
    } catch (e) {}
  }
  scrub();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrub);
  }
  if (!window.__rbNativeUiScrubber) {
    window.__rbNativeUiScrubber = new MutationObserver(scrub);
    window.__rbNativeUiScrubber.observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(scrub, 500);
  window.__restorebraineScrubLegacyUi = scrub;
})();

/** Stripe in-app payment — v289. Patches InAppBrowser before React bundle loads. */
(function rbStripeInAppPatch() {
  if (typeof window === 'undefined' || window.__restorebraineStripeInAppPatched) return;
  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  var OPTS = {
    showURL: false,
    showToolbar: true,
    closeButtonText: 'Cancel',
    toolbarPosition: 0,
    showNavigationButtons: false,
  };

  function isStripe(url) {
    try {
      return /(^|\.)stripe\.com$/i.test(new URL(String(url || ''), window.location.href).hostname);
    } catch (e) {
      return /checkout\.stripe\.com|pay\.stripe\.com/i.test(String(url || ''));
    }
  }

  function getIB() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser) || null;
  }

  function patchIB(ib) {
    if (!ib || ib.__restorebraineStripePatched) return;
    ib.__restorebraineStripePatched = true;
    window.__restorebraineStripeInAppPatched = true;

    if (typeof ib.openInSystemBrowser === 'function') {
      var orig = ib.openInSystemBrowser.bind(ib);
      ib.openInSystemBrowser = function (opts) {
        var url = opts && (opts.url || opts);
        if (isStripe(url) && typeof ib.openInWebView === 'function') {
          return ib.openInWebView(
            typeof opts === 'object' && opts !== null
              ? opts
              : { url: String(opts || ''), options: OPTS },
          );
        }
        return orig(opts);
      };
    }
  }

  var attempts = 0;
  var timer = setInterval(function () {
    var ib = getIB();
    if (ib) {
      patchIB(ib);
      clearInterval(timer);
      return;
    }
    attempts += 1;
    if (attempts > 150) clearInterval(timer);
  }, 100);
})();
