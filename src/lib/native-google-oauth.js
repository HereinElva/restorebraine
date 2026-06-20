import { InAppBrowser, DefaultWebViewOptions } from '@capacitor/inappbrowser';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
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
let browserListenerAttached = false;

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

const hasRegisteredNativeOAuthPlugin = () => {
  const plugin = window.Capacitor?.Plugins?.RestorebraineOAuth;
  return typeof plugin?.startGoogleOAuth === 'function';
};

const attachBrowserOAuthListener = async () => {
  if (browserListenerAttached) return;
  browserListenerAttached = true;
  await Browser.addListener('browserFinished', async () => {
    window.__restorebraineOAuthInProgress = false;
    await tryRestoreSessionAfterOAuth();
  });
};

const openInAppBrowserOAuth = async (oauthUrl, provider) => {
  oauthListenerAttached = false;
  await attachOAuthCompletionListener();
  window.__restorebraineLastOAuthUrl = oauthUrl;
  window.__restorebraineOAuthInProgress = true;

  if (LOCAL_NATIVE_BUNDLE) {
    window.__restorebraineOAuthMode = 'cap-browser';
    await attachBrowserOAuthListener();
    try {
      await Browser.open({ url: oauthUrl });
      return;
    } catch (browserError) {
      console.warn('Capacitor Browser failed, trying InAppBrowser:', browserError);
    }
  }

  window.__restorebraineOAuthMode = 'system-browser';
  try {
    await InAppBrowser.openInSystemBrowser({ url: oauthUrl, options: SYSTEM_BROWSER_OPTIONS });
    return;
  } catch (systemError) {
    console.warn('InAppBrowser system browser failed, trying WebView:', systemError);
  }

  window.__restorebraineOAuthMode = provider === 'google' ? 'webview-google' : 'webview';
  try {
    await InAppBrowser.openInWebView({ url: oauthUrl, options: DefaultWebViewOptions });
    return;
  } catch (webviewError) {
    console.warn('InAppBrowser WebView failed:', webviewError);
  }

  throw new Error('Could not open sign in. Rebuild in Xcode and try again.');
};

const finishOAuthLogin = async () => {
  window.__restorebraineOAuthInProgress = false;
  await InAppBrowser.close().catch(() => {});
  const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (token) {
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
    window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete'));
  }
  // v4-core: React AuthContext updates in-place — no reload (reload caused white screen).
  if (LOCAL_NATIVE_BUNDLE && token) return;
  if (window.location.pathname === '/' && token) return;
  window.location.replace(getNativeWebViewHome());
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

const openOAuthInSystemBrowser = async (url, providerHint) => {
  // Build v4 fallback: hosted from_url so OAuth sheet can return via restorebraine:// deep link.
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
  oauthListenerAttached = false;
  await attachOAuthCompletionListener();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const plugin = window.Capacitor?.Plugins?.InAppBrowser;
      if (plugin?.openInSystemBrowser) {
        await plugin.openInSystemBrowser({ url: normalizedUrl, options: SYSTEM_BROWSER_OPTIONS });
      } else {
        await InAppBrowser.openInSystemBrowser({ url: normalizedUrl, options: SYSTEM_BROWSER_OPTIONS });
      }
      return;
    } catch (error) {
      if (attempt === 59) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

const handleOAuthBrowserNavigation = async (url) => {
  if (!url) return false;
  if (await handleNativeOAuthCallback(url)) return true;

  try {
    const parsed = new URL(url, window.location.href);
    const token = parsed.searchParams.get('access_token');
    if (token) {
      await persistSessionToNativeStorage(token);
      await finishOAuthLogin();
      return true;
    }
    if (LOCAL_NATIVE_BUNDLE && isHostedOAuthReturn(url)) {
      await redirectToNativeBundleHome(url);
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
  oauthListenerAttached = true;

  await InAppBrowser.addListener('browserPageNavigationCompleted', async (data) => {
    await handleOAuthBrowserNavigation(data?.url);
  });

  await InAppBrowser.addListener('browserClosed', async () => {
    oauthListenerAttached = false;
    window.__restorebraineOAuthInProgress = false;
    if (await tryRestoreSessionAfterOAuth()) return;

    try {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      if (launch?.url && (await handleNativeOAuthCallback(launch.url))) return;
    } catch {}

    if (localStorage.getItem('b44_signed_out') !== '1') {
      await tryRestoreSessionAfterOAuth();
    }
  });
};

/** Google OAuth via native ASWebAuthenticationSession (works without v4 bridge). */
const startGoogleOAuthNative = async () => {
  const pluginUrl = normalizeAuthUrl(getGoogleOAuthUrl(), 'google');
  window.__restorebraineLastOAuthUrl = pluginUrl;
  window.__restorebraineOAuthMode = 'asweb-auth';
  window.__restorebraineOAuthInProgress = true;

  const plugin = window.Capacitor?.Plugins?.RestorebraineOAuth;
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

  // v4-core: Browser.open first — native plugin wait caused dead "Opening sign in…" on device.
  if (LOCAL_NATIVE_BUNDLE) {
    await openInAppBrowserOAuth(oauthUrl, provider);
    return;
  }

  if (provider === 'google' && hasRegisteredNativeOAuthPlugin()) {
    try {
      await withTimeout(startGoogleOAuthNative(), 5000, 'Google OAuth');
      return;
    } catch (error) {
      window.__restorebraineOAuthInProgress = false;
      if (error?.code === 'CANCELED' || /cancel/i.test(error?.message || '')) return;
      console.warn('Native Google OAuth failed — opening InAppBrowser:', error);
    }
  }

  await openInAppBrowserOAuth(oauthUrl, provider);
};

/** Install OAuth listeners once at app startup (deep links + InAppBrowser navigation). */
export const installNativeOAuthListeners = async () => {
  if (typeof window === 'undefined' || window.__restorebraineOAuthListenersInstalled) return;
  window.__restorebraineOAuthListenersInstalled = true;
  installNativeOAuthBridgeListener();

  window.__restorebraineOpenLogin = () => openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
  window.__restorebraineOpenProviderLogin = (provider) => {
    const p = provider || 'google';
    const url = p === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(p);
    return openLoginInSystemBrowser(url, p);
  };

  try {
    const { installNativeOAuthDeepLinkHandler } = await import('@/lib/session-bootstrap');
    await installNativeOAuthDeepLinkHandler();
    oauthListenerAttached = false;
    await attachOAuthCompletionListener();
  } catch (error) {
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
