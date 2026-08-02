import {
  getGoogleOAuthUrl,
  getProviderOAuthUrl,
  NATIVE_OAUTH_CALLBACK,
  isBase44PlatformHost,
  isAuthNavigationUrl,
  normalizeAuthUrl,
} from '@/lib/native-platform-guard';
import { getAuthReturnOrigin } from '@/lib/app-domains';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { resetToGalleryHome } from '@/lib/gallery-nav';

const GOOGLE_OAUTH_PATTERN = /accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com|\/api\/apps\/auth\/login/i;

let _InAppBrowser = null;
async function getInAppBrowser() {
  if (_InAppBrowser) return _InAppBrowser;
  const mod = await import('@capacitor/inappbrowser');
  _InAppBrowser = mod.InAppBrowser;
  return _InAppBrowser;
}

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

export const isOAuthCallbackUrl = (url) =>
  Boolean(url && typeof url === 'string' && url.includes('access_token='));

const isBundledNativeShell = () => {
  try {
    if (typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== 'undefined' && __RESTOREBRAINE_NATIVE_LOCAL__) return true;
    const p = window.location?.protocol;
    return p === 'capacitor:' || p === 'ionic:' || Boolean(window.__restorebraineMinimalBridge);
  } catch {
    return false;
  }
};

/** After OAuth, native bridge may save token before React listeners attach. */
export const tryRestoreSessionAfterOAuth = async () => {
  const existing = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (existing && localStorage.getItem('b44_signed_out') !== '1') {
    await persistSessionToNativeStorage(existing);
    try {
      window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: existing } }));
      window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete', { detail: { token: existing } }));
      resetToGalleryHome();
    } catch {}
    return true;
  }

  const { restoreSessionFromNativeStorage } = await import('@/lib/session-bootstrap');
  const token = await restoreSessionFromNativeStorage();
  if (!token) return false;

  try {
    window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
    window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete', { detail: { token } }));
    resetToGalleryHome();
  } catch {}
  return true;
};

export const captureOAuthTokenFromUrl = async (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url, getAuthReturnOrigin());
    const token = parsed.searchParams.get('access_token');
    if (!token) return null;
    try { localStorage.removeItem('b44_signed_out'); } catch {}
    await persistSessionToNativeStorage(token);
    try {
      window.dispatchEvent(new CustomEvent('restorebraine-native-oauth-complete', { detail: { token } }));
    } catch {}
    return token;
  } catch {
    return null;
  }
};

let oauthListenerAttached = false;

const finishOAuthLogin = async () => {
  const InAppBrowser = await getInAppBrowser();
  await InAppBrowser.close().catch(() => {});
  if (await tryRestoreSessionAfterOAuth()) return;
  if (isBundledNativeShell()) return;
  window.location.replace(getAuthReturnOrigin());
};

export const handleNativeOAuthCallback = async (url) => {
  const token = await captureOAuthTokenFromUrl(url);
  if (!token) return false;
  await finishOAuthLogin();
  return true;
};

const attachOAuthCompletionListener = async () => {
  if (oauthListenerAttached) return;
  oauthListenerAttached = true;

  const InAppBrowser = await getInAppBrowser();
  await InAppBrowser.addListener('browserClosed', async () => {
    if (await tryRestoreSessionAfterOAuth()) return;
    try {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      if (launch?.url) await handleNativeOAuthCallback(launch.url);
    } catch {}
    if (!isBundledNativeShell()) {
      window.location.replace(getAuthReturnOrigin());
    }
  });
};

/** Google blocks embedded WebViews — must use SFSafariViewController (openInSystemBrowser). */
export const openLoginInSystemBrowser = async (url = getGoogleOAuthUrl(), providerHint) => {
  const normalizedUrl = normalizeAuthUrl(url, providerHint);
  if (!isNativeShell()) {
    window.location.replace(normalizedUrl);
    return;
  }

  const { waitForCapacitorBridge } = await import('@/lib/capacitor-ready');
  await waitForCapacitorBridge();

  oauthListenerAttached = false;
  await attachOAuthCompletionListener();
  const InAppBrowser = await getInAppBrowser();

  const tryOpen = async () => {
    if (InAppBrowser?.openInSystemBrowser) {
      await InAppBrowser.openInSystemBrowser({ url: normalizedUrl, options: SYSTEM_BROWSER_OPTIONS });
      return true;
    }
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: normalizedUrl });
      return true;
    } catch {
      return false;
    }
  };

  if (await tryOpen()) return;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => { window.setTimeout(resolve, 100); });
    if (await tryOpen()) return;
  }

  if (typeof window.__restorebraineOpenLogin === 'function') {
    window.__restorebraineOpenLogin();
    return;
  }

  console.warn('InAppBrowser/Browser plugins unavailable — falling back to navigation');
  window.location.assign(normalizedUrl);
};

export const launchProviderOAuth = (provider = 'google') => {
  const url = provider === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(provider);
  if (typeof window !== 'undefined' && typeof window.__restorebraineOpenProviderLogin === 'function') {
    try {
      window.__restorebraineOpenProviderLogin(provider);
      return;
    } catch (error) {
      console.warn('Native provider login bridge failed:', error);
    }
  }
  if (typeof window.__restorebraineOpenLogin === 'function') {
    window.__restorebraineOpenLogin();
    return;
  }
  void openLoginInSystemBrowser(url, provider);
};

/** Install JS OAuth fallbacks when AppDelegate bridge is not ready yet. */
export const installNativeOAuthListeners = async () => {
  if (typeof window === 'undefined' || window.__restorebraineOAuthListenersInstalled) return;

  const { waitForCapacitorBridge } = await import('@/lib/capacitor-ready');
  if (!(await waitForCapacitorBridge(100))) return;

  window.__restorebraineOAuthListenersInstalled = true;

  if (!window.__restorebraineBundledOAuthInstalled && !window.__restorebraineSessionBridgeInstalled) {
    window.__restorebraineOpenLogin = () => {
      void openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
    };
    window.__restorebraineOpenProviderLogin = (provider) => {
      const p = provider || 'google';
      const oauthUrl = p === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(p);
      void openLoginInSystemBrowser(oauthUrl, p);
    };
  }

  window.addEventListener('restorebraine-native-oauth-complete', () => {
    void tryRestoreSessionAfterOAuth();
  });

  try {
    const { installNativeOAuthDeepLinkHandler } = await import('@/lib/session-bootstrap');
    await installNativeOAuthDeepLinkHandler();
    oauthListenerAttached = false;
    await attachOAuthCompletionListener();
  } catch (error) {
    window.__restorebraineOAuthListenersInstalled = false;
    console.warn('Native OAuth listener setup failed:', error);
  }
};

const handleAuthNavigation = (url, providerHint) => {
  openLoginInSystemBrowser(url, providerHint);
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
          captureOAuthTokenFromUrl(parsed.href).then((token) => {
            if (token) window.location.replace(getAuthReturnOrigin());
          });
          return;
        }
        if (isAuthNavigationUrl(url)) {
          handleAuthNavigation(url);
          return;
        }
        if (isBase44PlatformHost(parsed.hostname)) {
          window.location.replace(getAuthReturnOrigin());
          return;
        }
      } catch {}

      if (isAuthNavigationUrl(url)) {
        handleAuthNavigation(url);
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
              captureOAuthTokenFromUrl(parsed.href).then((token) => {
                if (token) window.location.replace(getAuthReturnOrigin());
              });
              return;
            }
            if (isAuthNavigationUrl(value)) {
              handleAuthNavigation(value);
              return;
            }
            if (isBase44PlatformHost(parsed.hostname)) {
              window.location.replace(getAuthReturnOrigin());
              return;
            }
          } catch {}
          if (isAuthNavigationUrl(value)) {
            handleAuthNavigation(value);
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

  installLocationNavigationGuard();

  const originalOpen = window.open;
  window.open = function openWithSystemBrowser(url, target, features) {
    if (typeof url === 'string' && url.length > 0) {
      if (isAuthNavigationUrl(url)) {
        handleAuthNavigation(url);
        return window;
      }
      window.location.assign(url);
      return window;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };
};

export { NATIVE_OAUTH_CALLBACK, getProviderOAuthUrl };
