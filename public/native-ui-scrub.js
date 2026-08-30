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

/** Stripe in-app payment — v291. Hooks Capacitor native bridge + registerPlugin. */
(function rbStripeInAppPatch() {
  if (typeof window === 'undefined') return;

  window.__restorebraineStripePatchVersion = 291;

  var OPTS = {
    showURL: false,
    showToolbar: true,
    closeButtonText: 'Cancel',
    toolbarPosition: 0,
    showNavigationButtons: false,
  };

  function isNative() {
    var cap = window.Capacitor;
    return cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  }

  function isStripe(url) {
    try {
      return /(^|\.)stripe\.com$/i.test(new URL(String(url || ''), window.location.href).hostname);
    } catch (e) {
      return /checkout\.stripe\.com|pay\.stripe\.com/i.test(String(url || ''));
    }
  }

  function stripeCheckoutUrl(options) {
    if (!options || typeof options !== 'object') return '';
    return options.url || options.href || '';
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
    if (!isNative()) return false;
    var cap = window.Capacitor;
    var ib = patchIB(cap.Plugins && cap.Plugins.InAppBrowser);
    if (ib && typeof ib.openInWebView === 'function') {
      ib.openInWebView({ url: String(url), options: OPTS }).catch(function () {});
      return true;
    }
    if (cap.nativePromise) {
      cap.nativePromise('InAppBrowser', 'openInWebView', { url: String(url), options: OPTS }).catch(function () {});
      return true;
    }
    return false;
  }

  function redirectInAppBrowserCall(pluginName, methodName, options) {
    if (pluginName !== 'InAppBrowser' || methodName !== 'openInSystemBrowser') {
      return { pluginName: pluginName, methodName: methodName, options: options };
    }
    var url = stripeCheckoutUrl(options);
    if (!isStripe(url)) {
      return { pluginName: pluginName, methodName: methodName, options: options };
    }
    var next = options && typeof options === 'object' ? Object.assign({}, options) : { url: String(url) };
    if (!next.options) next.options = OPTS;
    return { pluginName: pluginName, methodName: 'openInWebView', options: next };
  }

  function hookCapacitorBridge() {
    if (!isNative()) return;
    var cap = window.Capacitor;
    if (!cap) return;

    if (typeof cap.registerPlugin === 'function' && !cap.registerPlugin.__rbStripeHooked) {
      var origRegister = cap.registerPlugin.bind(cap);
      cap.registerPlugin = function (name, impl) {
        var plugin = origRegister(name, impl);
        if (name === 'InAppBrowser') patchIB(plugin);
        return plugin;
      };
      cap.registerPlugin.__rbStripeHooked = true;
    }

    if (cap.toNative && !cap.toNative.__rbStripeWrapped) {
      var origToNative = cap.toNative.bind(cap);
      cap.toNative = function (pluginName, methodName, options, storedCallback) {
        var redirected = redirectInAppBrowserCall(pluginName, methodName, options);
        return origToNative(
          redirected.pluginName,
          redirected.methodName,
          redirected.options,
          storedCallback,
        );
      };
      cap.toNative.__rbStripeWrapped = true;
    }

    if (cap.nativePromise && !cap.nativePromise.__rbStripeWrapped) {
      var origPromise = cap.nativePromise.bind(cap);
      cap.nativePromise = function (pluginName, methodName, options) {
        var redirected = redirectInAppBrowserCall(pluginName, methodName, options);
        return origPromise(redirected.pluginName, redirected.methodName, redirected.options);
      };
      cap.nativePromise.__rbStripeWrapped = true;
    }

    if (cap.Plugins && cap.Plugins.InAppBrowser) {
      patchIB(cap.Plugins.InAppBrowser);
    }
  }

  hookCapacitorBridge();
  var bridgeTimer = setInterval(function () {
    hookCapacitorBridge();
  }, 100);
  setTimeout(function () {
    clearInterval(bridgeTimer);
  }, 30000);

  function wrapNavigation() {
    if (!isNative()) return;
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
