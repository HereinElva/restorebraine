import { InAppBrowser } from '@capacitor/inappbrowser';
import { Capacitor } from '@capacitor/core';
import { RestorebraineOAuth } from '@/lib/native-oauth-plugin';
import { isAppHost, NATIVE_OAUTH_RETURN_URL, getAuthReturnOrigin } from '@/lib/app-domains';
import {
  getGoogleOAuthUrl,
  getProviderOAuthUrl,
  getWebViewOAuthUrl,
  getCanonicalOAuthUrl,
  BASE44_APP_ID,
  BASE44_PLATFORM_URL,
  NATIVE_OAUTH_CALLBACK,
  isBase44PlatformHost,
  isAuthNavigationUrl,
  isPlatformLoginUrl,
  normalizeAuthUrl,
} from '@/lib/native-platform-guard';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { isNativeShell, getNativeWebViewHome } from '@/lib/native-hosted-redirect';
import { shouldBlockExternalNavigation, redirectToNativeBundleHome } from '@/lib/native-bundle-shell-guard';
const GOOGLE_OAUTH_PATTERN = /accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com|\/api\/apps\/auth\/login/i;

const SYSTEM_BROWSER_OPTIONS = {
  iOS: { closeButtonText: 2, viewStyle: 2, animationEffect: 2, enableBarsCollapsing: true, enableReadersMode: false },
  android: { showTitle: false, hideToolbarOnScroll: false, viewStyle: 0, startAnimation: 0, exitAnimation: 1 },
};

/** In-app modal WebView — no iOS "use app.base44.com" system popup, no external Safari sheet. */
const WEBVIEW_OPTIONS = {
  showURL: false,
  showToolbar: true,
  clearCache: false,
  clearSessionCache: false,
  closeButtonText: 'Cancel',
  toolbarPosition: 0,
  showNavigationButtons: false,
  iOS: { viewStyle: 2, animationEffect: 2, allowsBackForwardNavigationGestures: false },
  android: { allowZoom: false, hardwareBack: true },
};

export const isGoogleOAuthUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const { hostname, href, pathname } = new URL(url, window.location.href);
    return GOOGLE_OAUTH_PATTERN.test(hostname) || GOOGLE_OAUTH_PATTERN.test(href) || GOOGLE_OAUTH_PATTERN.test(pathname);
  } catch {
    return GOOGLE_OAUTH_PATTERN.test(url);
  }
};

export const isOAuthCallbackUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('access_token=')) return true;
  if (LOCAL_NATIVE_BUNDLE && url.startsWith(NATIVE_OAUTH_RETURN_URL.split('?')[0])) return true;
  return false;
};

export const captureOAuthTokenFromUrl = async (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(String(url));
    const token = parsed.searchParams.get('access_token');
    if (!token) return null;
    await persistSessionToNativeStorage(token);
    return token;
  } catch {
    try {
      const match = String(url).match(/[?&]access_token=([^&]+)/);
      if (!match?.[1]) return null;
      const token = decodeURIComponent(match[1]);
      await persistSessionToNativeStorage(token);
      return token;
    } catch {
      return null;
    }
  }
};

let oauthListenerAttached = false;
let oauthListenerAttachPromise = null;
let oauthTokenPollTimer = null;

const waitForCapacitorBridge = async (maxAttempts = 100) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (window.Capacitor?.Plugins?.InAppBrowser?.openInWebView) return true;
    if (InAppBrowser?.openInWebView) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return Boolean(window.Capacitor?.Plugins?.InAppBrowser?.openInWebView || InAppBrowser?.openInWebView);
};

const stopOAuthTokenPoll = () => {
  if (oauthTokenPollTimer) {
    clearInterval(oauthTokenPollTimer);
    oauthTokenPollTimer = null;
  }
};

const startOAuthTokenPoll = () => {
  stopOAuthTokenPoll();
  oauthTokenPollTimer = setInterval(async () => {
    if (!window.__restorebraineOAuthInProgress) {
      stopOAuthTokenPoll();
      return;
    }
    try {
      const existing = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (existing && localStorage.getItem('b44_signed_out') !== '1') {
        await finishOAuthLogin();
        return;
      }
      if (await tryRestoreSessionAfterOAuth()) {
        await finishOAuthLogin();
      }
    } catch {
      /* ignore poll errors */
    }
  }, 400);
};

const signalOAuthEnded = () => {
  window.__restorebraineOAuthInProgress = false;
  stopOAuthTokenPoll();
  window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
};

const withTimeout = (promise, ms, label = 'Operation') =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);

const isNativeCapacitorShell = () => {
  if (Capacitor.isNativePlatform?.()) return true;
  try {
    const { protocol } = window.location;
    return protocol === 'capacitor:' || protocol === 'ionic:';
  } catch {
    return false;
  }
};

/** Capacitor 8 exposes InAppBrowser via ES import — not always on window.Capacitor.Plugins. */
const waitForCapacitor = async () => isNativeCapacitorShell();

/** Prefer Capacitor.Plugins (reliable on device) — ES import alone often fails before bridge is ready. */
const getInAppBrowserPluginAsync = async (maxAttempts = 60) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const plugin = window.Capacitor?.Plugins?.InAppBrowser;
    if (plugin?.openInWebView || plugin?.openInSystemBrowser) return plugin;
    if (InAppBrowser?.openInWebView || InAppBrowser?.openInSystemBrowser) return InAppBrowser;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('InAppBrowser plugin not available — rebuild in Xcode and try again.');
};

const recordOAuthDebug = (patch = {}) => {
  if (typeof window === 'undefined') return;
  window.__restorebraineLastOAuthDebug = {
    ...(window.__restorebraineLastOAuthDebug || {}),
    at: Date.now(),
    ...patch,
  };
};

const recordOAuthError = (error, stage = 'oauth') => {
  const message = error?.message || error?.errorMessage || String(error || 'Unknown OAuth error');
  recordOAuthDebug({ stage, error: message, code: error?.code });
  if (typeof window !== 'undefined') {
    window.__restorebraineLastOAuthError = message;
  }
  return message;
};

const getNativeOAuthPlugin = () => {
  if (typeof RestorebraineOAuth?.startGoogleOAuth === 'function') return RestorebraineOAuth;
  const legacy = window.Capacitor?.Plugins?.RestorebraineOAuth;
  if (typeof legacy?.startGoogleOAuth === 'function') return legacy;
  return null;
};

const hasRegisteredNativeOAuthPlugin = () => Boolean(getNativeOAuthPlugin());

const waitForNativeOAuthPlugin = async (maxAttempts = 80) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (hasRegisteredNativeOAuthPlugin()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return hasRegisteredNativeOAuthPlugin();
};

const openInAppBrowserOAuth = async (oauthUrl, provider) => {
  await openOAuthInSystemBrowser(oauthUrl, provider);
};

const finishOAuthLogin = async () => {
  stopOAuthTokenPoll();
  window.__restorebraineOAuthInProgress = false;
  try {
    const ib = await getInAppBrowserPluginAsync(5);
    await ib.close?.().catch(() => {});
  } catch {
    await InAppBrowser.close().catch(() => {});
  }
  const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (token) {
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
  }
  window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
  // v4-core: React AuthContext updates in-place — no reload (reload caused white screen).
  if (LOCAL_NATIVE_BUNDLE && token) return;
  if (window.location.pathname === '/' && token) return;
  if (token) window.location.replace(getNativeWebViewHome());
};

/** After OAuth, AppDelegate / native plugin may have saved the token before JS listeners attach. */
export const tryRestoreSessionAfterOAuth = async () => {
  const existing = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (existing && localStorage.getItem('b44_signed_out') !== '1') {
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: existing } }));
    window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
    if (LOCAL_NATIVE_BUNDLE) return true;
    window.location.replace(getNativeWebViewHome());
    return true;
  }

  const { restoreSessionFromNativeStorage } = await import('@/lib/session-bootstrap');
  const token = await restoreSessionFromNativeStorage();
  if (!token) return false;

  window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
  window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
  if (LOCAL_NATIVE_BUNDLE) return true;
  window.location.replace(getNativeWebViewHome());
  return true;
};

export const handleNativeOAuthCallback = async (url) => {
  const token = await captureOAuthTokenFromUrl(url);
  if (!token) return false;
  await finishOAuthLogin();
  return true;
};

const isHostedOAuthReturn = (url) => {
  try {
    const parsed = new URL(String(url), window.location.href);
    return isAppHost(parsed.hostname) && parsed.searchParams.has('access_token');
  } catch {
    return false;
  }
};

const openWithBrowserFallback = async (url) => {
  if (LOCAL_NATIVE_BUNDLE) {
    throw new Error('Native sign-in sheet unavailable. Tap the button again.');
  }
  recordOAuthDebug({ stage: 'browser-fallback', url: String(url).slice(0, 120) });
  window.__restorebraineOAuthMode = 'cap-browser';
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
};

const waitForOAuthBrowserClose = async (ib) => {
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('restorebraine-native-oauth-complete', onComplete);
      resolve();
    };
    const onComplete = () => finish();
    window.addEventListener('restorebraine-native-oauth-complete', onComplete);
    ib.addListener('browserClosed', () => finish()).catch(() => finish());
    setTimeout(finish, 180000);
  });
};

/** Bundled native: in-app WebView modal — captures HTTPS ?access_token= without leaving Restorebraine. */
const openOAuthInWebView = async (url, providerHint) => {
  const normalizedUrl = normalizeAuthUrl(
    url || getWebViewOAuthUrl(providerHint || 'google'),
    providerHint,
    { forWebView: true },
  );
  if (typeof window !== 'undefined') {
    window.__restorebraineLastOAuthUrl = normalizedUrl;
    window.__restorebraineOAuthMode = 'v4-webview';
    window.__restorebraineOAuthInProgress = true;
  }
  recordOAuthDebug({ stage: 'inapp-webview', url: normalizedUrl.slice(0, 120) });

  await waitForCapacitorBridge(80);
  await attachOAuthCompletionListener();
  startOAuthTokenPoll();

  const ib = await getInAppBrowserPluginAsync(80);
  if (!ib?.openInWebView) {
    signalOAuthEnded();
    throw new Error('InAppBrowser openInWebView not available — rebuild in Xcode.');
  }

  // Do NOT await openInWebView — on iOS the promise may not resolve until the sheet closes,
  // which leaves the login button stuck on "Opening Google…".
  ib.openInWebView({ url: normalizedUrl, options: WEBVIEW_OPTIONS }).catch((error) => {
    if (!window.__restorebraineOAuthInProgress) return;
    signalOAuthEnded();
    recordOAuthError(error, 'inappbrowser-webview-open');
  });

  await new Promise((resolve) => setTimeout(resolve, 350));
};

const openOAuthInSystemBrowser = async (url, providerHint) => {
  const normalizedUrl = normalizeAuthUrl(
    url || getWebViewOAuthUrl(providerHint || 'google'),
    providerHint,
    { forWebView: true },
  );
  if (typeof window !== 'undefined') {
    window.__restorebraineLastOAuthUrl = normalizedUrl;
    window.__restorebraineOAuthMode = 'v4-system-browser';
    window.__restorebraineOAuthInProgress = true;
  }
  recordOAuthDebug({ stage: 'system-browser', url: normalizedUrl.slice(0, 120) });
  await attachOAuthCompletionListener();
  startOAuthTokenPoll();
  const ib = await getInAppBrowserPluginAsync(30);
  try {
    await ib.openInSystemBrowser({ url: normalizedUrl, options: SYSTEM_BROWSER_OPTIONS });
  } catch (error) {
    window.__restorebraineOAuthInProgress = false;
    recordOAuthError(error, 'inappbrowser-open');
    throw error;
  }

  // Wait until OAuth completes or the user closes the browser sheet.
  await waitForOAuthBrowserClose(ib);
};

/** Bundled native: in-app WebView only — never ASWeb / system browser (no Base44 redirect popup). */
const openBundledNativeOAuth = async (oauthUrl, provider) => {
  recordOAuthDebug({ stage: 'bundled-oauth-start', url: oauthUrl.slice(0, 120) });
  try {
    await openOAuthInWebView(oauthUrl, provider);
  } catch (error) {
    window.__restorebraineOAuthInProgress = false;
    recordOAuthError(error, 'inappbrowser-webview');
    const message = error?.message || error?.errorMessage || String(error || '');
    if (error?.code === 'CANCELED' || /^oauth canceled$/i.test(message)) return;
    throw error;
  }
};

const handleOAuthBrowserNavigation = async (url) => {
  if (!url) return false;
  recordOAuthDebug({ stage: 'oauth-nav', url: String(url).slice(0, 160) });
  if (await handleNativeOAuthCallback(url)) return true;

  try {
    const parsed = new URL(url, window.location.href);
    const token = parsed.searchParams.get('access_token');
    if (token) {
      await persistSessionToNativeStorage(token);
      await finishOAuthLogin();
      return true;
    }
    if (LOCAL_NATIVE_BUNDLE && isAppHost(parsed.hostname) && parsed.searchParams.has('access_token')) {
      await persistSessionToNativeStorage(parsed.searchParams.get('access_token'));
      await finishOAuthLogin();
      return true;
    }
    if (isAuthNavigationUrl(url)) {
      return false;
    }
  } catch {}

  return false;
};

const attachOAuthCompletionListener = async () => {
  if (oauthListenerAttached) return;
  if (oauthListenerAttachPromise) return oauthListenerAttachPromise;

  oauthListenerAttachPromise = (async () => {
    try {
      await waitForCapacitorBridge(80);
      const ib = await getInAppBrowserPluginAsync(80);
      await ib.addListener('browserPageNavigationCompleted', async (data) => {
        await handleOAuthBrowserNavigation(data?.url);
      });
      await ib.addListener('browserPageLoaded', async (data) => {
        await handleOAuthBrowserNavigation(data?.url);
      });
      await ib.addListener('browserClosed', async () => {
        if (await tryRestoreSessionAfterOAuth()) {
          stopOAuthTokenPoll();
          window.__restorebraineOAuthInProgress = false;
          return;
        }
        try {
          const { App } = await import('@capacitor/app');
          const launch = await App.getLaunchUrl();
          if (launch?.url && (await handleNativeOAuthCallback(launch.url))) return;
        } catch {}
        if (localStorage.getItem('b44_signed_out') !== '1') {
          await tryRestoreSessionAfterOAuth();
        }
        signalOAuthEnded();
      });
      oauthListenerAttached = true;
    } catch (error) {
      oauthListenerAttached = false;
      recordOAuthError(error, 'oauth-listeners');
      throw error;
    } finally {
      oauthListenerAttachPromise = null;
    }
  })();

  return oauthListenerAttachPromise;
};

/** OAuth via native ASWebAuthenticationSession — all providers (URL-driven, not Google-only). */
const startNativeOAuthSession = async (oauthUrl, provider = 'google') => {
  const pluginUrl = normalizeAuthUrl(oauthUrl || getCanonicalOAuthUrl(provider), provider);
  window.__restorebraineLastOAuthUrl = pluginUrl;
  window.__restorebraineOAuthMode = 'asweb-auth';
  window.__restorebraineOAuthInProgress = true;
  recordOAuthDebug({ stage: 'asweb-auth', url: pluginUrl.slice(0, 120) });

  const plugin = getNativeOAuthPlugin();
  if (!plugin?.startGoogleOAuth) throw new Error('RestorebraineOAuth plugin not registered');

  const result = await plugin.startGoogleOAuth({ url: pluginUrl });
  const token = result?.token;
  if (!token) throw new Error('Native OAuth returned no token');
  await persistSessionToNativeStorage(token);
  await finishOAuthLogin();
  return true;
};

/**
 * v4-core OAuth: native plugin for Google when available, always fall back to InAppBrowser (visible UI).
 */
export const openLoginInSystemBrowser = async (url = getGoogleOAuthUrl(), providerHint) => {
  const provider = providerHint || 'google';
  if (typeof window !== 'undefined') {
    window.__restorebraineOAuthInProgress = true;
  }
  if (!isNativeShell()) {
    window.location.replace(normalizeAuthUrl(url, providerHint));
    return;
  }

  if (!(await waitForCapacitor())) {
    window.__restorebraineOAuthInProgress = false;
    throw new Error('Not running in the native app shell.');
  }

  const oauthUrl = isPlatformLoginUrl(url)
    ? String(url)
    : normalizeAuthUrl(url || getCanonicalOAuthUrl(provider), provider);
  window.__restorebraineLastOAuthUrl = oauthUrl;

  // Bundled: native iOS sign-in sheet first (proven on device), then InAppBrowser/Safari fallbacks.
  if (LOCAL_NATIVE_BUNDLE) {
    await openBundledNativeOAuth(oauthUrl, provider);
    return;
  }

  if (hasRegisteredNativeOAuthPlugin()) {
    try {
      await withTimeout(startNativeOAuthSession(oauthUrl, provider), 5000, 'OAuth');
      return;
    } catch (error) {
      window.__restorebraineOAuthInProgress = false;
      if (error?.code === 'CANCELED' || /cancel/i.test(error?.message || '')) return;
      console.warn('Native OAuth failed — opening system browser:', error);
    }
  }

  await openInAppBrowserOAuth(oauthUrl, provider);
};

/** Install OAuth listeners once Capacitor bridge + InAppBrowser are ready. */
export const installNativeOAuthListeners = async () => {
  if (typeof window === 'undefined' || window.__restorebraineOAuthListenersInstalled) return;

  const ready = await waitForCapacitorBridge(100);
  if (!ready) {
    console.warn('InAppBrowser not ready — OAuth listeners deferred until first login tap');
    return;
  }

  window.__restorebraineOAuthListenersInstalled = true;
  installNativeOAuthBridgeListener();

  if (!window.__restorebraineSessionBridgeInstalled) {
    window.__restorebraineOpenLogin = () => openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
    window.__restorebraineOpenProviderLogin = (provider) => {
      const p = provider || 'google';
      const url = p === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(p);
      return openLoginInSystemBrowser(url, p);
    };
  }

  try {
    const { installNativeOAuthDeepLinkHandler } = await import('@/lib/session-bootstrap');
    await installNativeOAuthDeepLinkHandler();
    await attachOAuthCompletionListener();
  } catch (error) {
    window.__restorebraineOAuthListenersInstalled = false;
    console.warn('Native OAuth listener setup failed:', error);
  }
};

const handleAuthNavigation = (url, providerHint) => {
  openLoginInSystemBrowser(url, providerHint);
};

const installNativeOAuthBridgeListener = () => {
  if (typeof window === 'undefined' || window.__restorebraineNativeOAuthBridgeInstalled) return;
  window.__restorebraineNativeOAuthBridgeInstalled = true;
  window.addEventListener('restorebraine-native-oauth-complete', () => {
    tryRestoreSessionAfterOAuth();
  });
};

export const installLocationNavigationGuard = () => {
  if (typeof window === 'undefined' || window.__restorebraineLocationGuardInstalled) return;
  window.__restorebraineLocationGuardInstalled = true;

  ['assign', 'replace'].forEach((method) => {
    const original = Location.prototype[method];
    Location.prototype[method] = function guardedNavigation(url) {
      try {
        const parsed = new URL(String(url), window.location.href);
        if (parsed.searchParams.get('access_token')) {
          redirectToNativeBundleHome(parsed.href);
          return;
        }
        if (isPlatformLoginUrl(url)) {
          handleAuthNavigation(getGoogleOAuthUrl(), 'google');
          return;
        }
        if (isAuthNavigationUrl(url)) {
          handleAuthNavigation(url);
          return;
        }
        if (shouldBlockExternalNavigation(url)) {
          redirectToNativeBundleHome(String(url));
          return;
        }
        if (isBase44PlatformHost(parsed.hostname)) {
          window.location.replace(getNativeWebViewHome());
          return;
        }
      } catch {}

      if (isPlatformLoginUrl(url)) {
        handleAuthNavigation(getGoogleOAuthUrl(), 'google');
        return;
      }
      if (isAuthNavigationUrl(url)) {
        handleAuthNavigation(url);
        return;
      }
      if (shouldBlockExternalNavigation(url)) {
        redirectToNativeBundleHome(String(url));
        return;
      }
      return original.call(this, url);
    };
  });

  try {
    const hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
      || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.location), 'href');
    if (hrefDescriptor?.set) {
      Object.defineProperty(window.location, 'href', {
        configurable: true,
        enumerable: hrefDescriptor.enumerable,
        get: hrefDescriptor.get?.bind(window.location),
        set(value) {
          try {
            const parsed = new URL(String(value), window.location.href);
            if (parsed.searchParams.get('access_token')) {
              redirectToNativeBundleHome(parsed.href);
              return;
            }
            if (isPlatformLoginUrl(value)) {
              handleAuthNavigation(getGoogleOAuthUrl(), 'google');
              return;
            }
            if (isAuthNavigationUrl(value)) {
              handleAuthNavigation(value);
              return;
            }
            if (shouldBlockExternalNavigation(value)) {
              redirectToNativeBundleHome(String(value));
              return;
            }
            if (isBase44PlatformHost(parsed.hostname)) {
              window.location.replace(getNativeWebViewHome());
              return;
            }
          } catch {}
          if (isPlatformLoginUrl(value)) {
            handleAuthNavigation(getGoogleOAuthUrl(), 'google');
            return;
          }
          if (isAuthNavigationUrl(value)) {
            handleAuthNavigation(value);
            return;
          }
          if (shouldBlockExternalNavigation(value)) {
            redirectToNativeBundleHome(String(value));
            return;
          }
          hrefDescriptor.set.call(window.location, value);
        },
      });
    }
  } catch (error) {
    console.warn('Could not patch window.location.href for OAuth guard.', error);
  }
};

export const installNativeGoogleOAuthBrowser = () => {
  if (typeof window === 'undefined' || window.__restorebraineGoogleOAuthBrowserInstalled) return;
  window.__restorebraineGoogleOAuthBrowserInstalled = true;

  installNativeOAuthBridgeListener();
  installLocationNavigationGuard();

  const originalOpen = window.open;
  window.open = function openWithInAppBrowser(url, target, features) {
    if (typeof url === 'string' && url.length > 0) {
      if (isPlatformLoginUrl(url) || isAuthNavigationUrl(url)) {
        handleAuthNavigation(isPlatformLoginUrl(url) ? getGoogleOAuthUrl() : url);
        return window;
      }
      if (shouldBlockExternalNavigation(url)) {
        redirectToNativeBundleHome(String(url));
        return window;
      }
      window.location.assign(url);
      return window;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };
};

export { NATIVE_OAUTH_CALLBACK, getProviderOAuthUrl };
