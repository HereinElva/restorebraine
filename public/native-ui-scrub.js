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

/** Stripe in-app payment — v290. Hooks Capacitor registerPlugin + navigation. */
(function rbStripeInAppPatch() {
  if (typeof window === 'undefined') return;
  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  window.__restorebraineStripePatchVersion = 290;

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

  function patchIB(ib) {
    if (!ib || ib.__restorebraineStripePatched) return ib;
    ib.__restorebraineStripePatched = true;

    if (typeof ib.openInSystemBrowser === 'function') {
      var origSystem = ib.openInSystemBrowser.bind(ib);
      ib.openInSystemBrowser = function (opts) {
        var url = opts && (opts.url || opts);
        if (isStripe(url) && typeof ib.openInWebView === 'function') {
          return ib.openInWebView(
            typeof opts === 'object' && opts !== null
              ? opts
              : { url: String(opts || ''), options: OPTS },
          );
        }
        return origSystem(opts);
      };
    }

    return ib;
  }

  function openStripeInApp(url) {
    var ib =
      patchIB(cap.Plugins && cap.Plugins.InAppBrowser) ||
      (cap.Plugins && cap.Plugins.InAppBrowser);
    if (!ib || typeof ib.openInWebView !== 'function') return false;
    ib.openInWebView({ url: String(url), options: OPTS }).catch(function () {});
    return true;
  }

  // Patch ES-module plugin instance when Capacitor registers it.
  if (typeof cap.registerPlugin === 'function' && !cap.__rbStripeRegisterHooked) {
    cap.__rbStripeRegisterHooked = true;
    var origRegister = cap.registerPlugin.bind(cap);
    cap.registerPlugin = function (name, impl) {
      var plugin = origRegister(name, impl);
      if (name === 'InAppBrowser') patchIB(plugin);
      return plugin;
    };
  }

  // Poll for Plugins.InAppBrowser (native bridge timing).
  var attempts = 0;
  var timer = setInterval(function () {
    if (cap.Plugins && cap.Plugins.InAppBrowser) {
      patchIB(cap.Plugins.InAppBrowser);
      clearInterval(timer);
      return;
    }
    attempts += 1;
    if (attempts > 200) clearInterval(timer);
  }, 100);

  // Re-wrap navigation after stripe-native-guard.js so Stripe opens in-app, not blocked silently.
  function wrapNavigation() {
    ['assign', 'replace'].forEach(function (method) {
      var current = Location.prototype[method];
      if (!current || current.__rbStripeOpenWrapped) return;
      Location.prototype[method] = function (url) {
        if (isStripe(url)) {
          openStripeInApp(url);
          return;
        }
        return current.call(this, url);
      };
      Location.prototype[method].__rbStripeOpenWrapped = true;
    });
  }

  wrapNavigation();
  setTimeout(wrapNavigation, 0);
  setTimeout(wrapNavigation, 100);
  setTimeout(wrapNavigation, 500);
})();
