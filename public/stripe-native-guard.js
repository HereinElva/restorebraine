/**
 * Hosted Capacitor: block full-page jumps to Stripe Checkout on native.
 * Opens via InAppBrowser from stripe-checkout.js instead.
 * Also inlined in index.html — keep both in sync.
 */
(function stripeNativeGuard() {
  if (typeof window === 'undefined' || window.__restorebraineStripeNativeGuardInstalled) return;

  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  window.__restorebraineStripeNativeGuardInstalled = true;

  var STRIPE_REQUEST_EVENT = 'restorebraine-stripe-checkout';

  function isStripeCheckoutUrl(url) {
    try {
      var parsed = new URL(String(url || ''), window.location.href);
      return /(^|\.)stripe\.com$/i.test(parsed.hostname);
    } catch (e) {
      return /checkout\.stripe\.com|pay\.stripe\.com/i.test(String(url || ''));
    }
  }

  function intercept(url) {
    if (!isStripeCheckoutUrl(url)) return false;
    window.dispatchEvent(
      new CustomEvent(STRIPE_REQUEST_EVENT, { detail: { url: String(url) } }),
    );
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
