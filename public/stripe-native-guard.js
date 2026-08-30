/**
 * Hosted Capacitor: keep Stripe Checkout inside the app on native.
 * v290 — hooks registerPlugin + opens in-app on navigation intercept.
 */
(function stripeNativeGuard() {
  if (typeof window === 'undefined' || window.__restorebraineStripeNativeGuardInstalled) return;

  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  window.__restorebraineStripeNativeGuardInstalled = true;

  var STRIPE_REQUEST_EVENT = 'restorebraine-stripe-checkout';
  var OPTS = {
    showURL: false,
    showToolbar: true,
    closeButtonText: 'Cancel',
    toolbarPosition: 0,
    showNavigationButtons: false,
  };

  function isStripeCheckoutUrl(url) {
    try {
      var parsed = new URL(String(url || ''), window.location.href);
      return /(^|\.)stripe\.com$/i.test(parsed.hostname);
    } catch (e) {
      return /checkout\.stripe\.com|pay\.stripe\.com/i.test(String(url || ''));
    }
  }

  function patchIB(ib) {
    if (!ib || ib.__restorebraineStripePatched) return ib;
    ib.__restorebraineStripePatched = true;
    if (typeof ib.openInSystemBrowser === 'function') {
      var orig = ib.openInSystemBrowser.bind(ib);
      ib.openInSystemBrowser = function (opts) {
        var url = opts && (opts.url || opts);
        if (isStripeCheckoutUrl(url) && typeof ib.openInWebView === 'function') {
          return ib.openInWebView(
            typeof opts === 'object' && opts !== null ? opts : { url: String(opts || ''), options: OPTS },
          );
        }
        return orig(opts);
      };
    }
    return ib;
  }

  function openStripeInApp(url) {
    var ib = patchIB(cap.Plugins && cap.Plugins.InAppBrowser);
    if (!ib || typeof ib.openInWebView !== 'function') return false;
    ib.openInWebView({ url: String(url), options: OPTS }).catch(function () {});
    return true;
  }

  if (typeof cap.registerPlugin === 'function' && !cap.__rbStripeRegisterHooked) {
    cap.__rbStripeRegisterHooked = true;
    var origRegister = cap.registerPlugin.bind(cap);
    cap.registerPlugin = function (name, impl) {
      var plugin = origRegister(name, impl);
      if (name === 'InAppBrowser') patchIB(plugin);
      return plugin;
    };
  }

  function intercept(url) {
    if (!isStripeCheckoutUrl(url)) return false;
    window.dispatchEvent(
      new CustomEvent(STRIPE_REQUEST_EVENT, { detail: { url: String(url) } }),
    );
    openStripeInApp(url);
    return true;
  }

  var originalAssign = Location.prototype.assign;
  Location.prototype.assign = function guardedAssign(url) {
    if (intercept(url)) return;
    return originalAssign.call(this, url);
  };

  var originalReplace = Location.prototype.replace;
  Location.prototype.replace = function guardedReplace(url) {
    if (intercept(url)) return;
    return originalReplace.call(this, url);
  };

  var originalOpen = window.open;
  window.open = function guardedOpen(url, target, features) {
    if (intercept(url)) return null;
    return originalOpen.call(window, url, target, features);
  };
})();
