/**
 * Hosted Capacitor: keep Stripe Checkout inside the app on native.
 * - Blocks location.assign / replace / window.open to stripe.com
 * - Redirects InAppBrowser.openInSystemBrowser → openInWebView for Stripe
 * - Opens in-app sheet directly (works even if an old JS bundle is cached)
 */
(function stripeNativeGuard() {
  if (typeof window === 'undefined' || window.__restorebraineStripeNativeGuardInstalled) return;

  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  window.__restorebraineStripeNativeGuardInstalled = true;

  var STRIPE_REQUEST_EVENT = 'restorebraine-stripe-checkout';
  var WEBVIEW_OPTIONS = {
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

  function getInAppBrowser() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.InAppBrowser) || null;
  }

  function openStripeInApp(url) {
    var ib = getInAppBrowser();
    if (!ib || typeof ib.openInWebView !== 'function') return false;
    ib.openInWebView({ url: String(url), options: WEBVIEW_OPTIONS }).catch(function () {});
    return true;
  }

  function patchInAppBrowser(ib) {
    if (!ib || ib.__restorebraineStripePatched) return;
    ib.__restorebraineStripePatched = true;

    if (typeof ib.openInSystemBrowser === 'function') {
      var originalSystem = ib.openInSystemBrowser.bind(ib);
      ib.openInSystemBrowser = function stripeSystemBrowser(opts) {
        var url = opts && (opts.url || opts);
        if (isStripeCheckoutUrl(url) && typeof ib.openInWebView === 'function') {
          return ib.openInWebView(
            typeof opts === 'object' && opts !== null
              ? opts
              : { url: String(opts || ''), options: WEBVIEW_OPTIONS },
          );
        }
        return originalSystem(opts);
      };
    }
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

  var patchAttempts = 0;
  var patchTimer = setInterval(function () {
    var ib = getInAppBrowser();
    if (ib) {
      patchInAppBrowser(ib);
      clearInterval(patchTimer);
      return;
    }
    patchAttempts += 1;
    if (patchAttempts > 120) clearInterval(patchTimer);
  }, 100);
})();
