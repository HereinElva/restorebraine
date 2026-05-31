import { InAppBrowser } from '@capacitor/inappbrowser';
import {
  getGoogleOAuthUrl,
  getProviderOAuthUrl,
  RESTOREBRAINE_FROM_URL,
  NATIVE_OAUTH_CALLBACK,
  isBase44PlatformHost,
  isAuthNavigationUrl,
  normalizeAuthUrl,
} from '@/lib/native-platform-guard';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { isNativeShell, reloadNativeAppHome } from '@/lib/native-hosted-redirect';

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

export const captureOAuthTokenFromUrl = async (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url, RESTOREBRAINE_FROM_URL);
    const token = parsed.searchParams.get('access_token');
    if (!token) return null;
    await persistSessionToNativeStorage(token);
    return token;
  } catch {
    return null;
  }
};

let oauthListenerAttached = false;

const finishOAuthLogin = async () => {
  await InAppBrowser.close().catch(() => {});
  reloadNativeAppHome();
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

  await InAppBrowser.addListener('browserClosed', async () => {
    const stored = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
    if (stored) {
      reloadNativeAppHome();
      return;
    }
    try {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      if (launch?.url) await handleNativeOAuthCallback(launch.url);
    } catch {}
    reloadNativeAppHome();
  });
};

/** Google blocks embedded WebViews — must use SFSafariViewController (openInSystemBrowser). */
export const openLoginInSystemBrowser = async (url = getGoogleOAuthUrl(), providerHint) => {
  const normalizedUrl = normalizeAuthUrl(url, providerHint);
  if (!isNativeShell()) {
    window.location.replace(normalizedUrl);
    return;
  }

  oauthListenerAttached = false;
  await attachOAuthCompletionListener();
  await InAppBrowser.openInSystemBrowser({ url: normalizedUrl, options: SYSTEM_BROWSER_OPTIONS });
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
            if (token) reloadNativeAppHome();
          });
          return;
        }
        const loginPath = parsed.pathname.replace(/\/$/, '') || '/';
        const isLoginPage = loginPath === '/login'
          && (isBase44PlatformHost(parsed.hostname) || parsed.hostname === 'restorebraine.base44.app');
        if (isAuthNavigationUrl(url) || isLoginPage) {
          handleAuthNavigation(getGoogleOAuthUrl());
          return;
        }
        if (isBase44PlatformHost(parsed.hostname)) {
          reloadNativeAppHome();
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
                if (token) reloadNativeAppHome();
              });
              return;
            }
            const loginPath = parsed.pathname.replace(/\/$/, '') || '/';
            const isLoginPage = loginPath === '/login'
              && (isBase44PlatformHost(parsed.hostname) || parsed.hostname === 'restorebraine.base44.app');
            if (isAuthNavigationUrl(value) || isLoginPage) {
              handleAuthNavigation(getGoogleOAuthUrl());
              return;
            }
            if (isBase44PlatformHost(parsed.hostname)) {
              reloadNativeAppHome();
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
