import { InAppBrowser } from '@capacitor/inappbrowser';
import {
  getAppScopedLoginUrl,
  getGoogleOAuthUrl,
  RESTOREBRAINE_FROM_URL,
  isBase44PlatformHost,
} from '@/lib/native-platform-guard';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { isNativeShell } from '@/lib/native-hosted-redirect';

const GOOGLE_OAUTH_PATTERN = /accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com|\/api\/apps\/auth\/login/i;

const SYSTEM_BROWSER_OPTIONS = {
  iOS: { closeButtonText: 2, viewStyle: 2, animationEffect: 2, enableBarsCollapsing: true, enableReadersMode: false },
  android: { showTitle: false, hideToolbarOnScroll: false, viewStyle: 0, startAnimation: 0, exitAnimation: 1 },
};

const WEBVIEW_OPTIONS = {
  showURL: true,
  showToolbar: true,
  clearCache: false,
  clearSessionCache: false,
  mediaPlaybackRequiresUserAction: false,
  closeButtonText: 'Done',
  toolbarPosition: 0,
  showNavigationButtons: true,
  leftToRight: false,
  customWebViewUserAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iOS: {
    allowOverScroll: true,
    enableViewportScale: false,
    allowInLineMediaPlayback: false,
    surpressIncrementalRendering: false,
    viewStyle: 2,
    animationEffect: 2,
    allowsBackForwardNavigationGestures: true,
  },
  android: { allowZoom: false, hardwareBack: true, pauseMedia: true },
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

export const isAuthNavigationUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(String(url), window.location.href);
    if (isGoogleOAuthUrl(url)) return true;
    if (isBase44PlatformHost(parsed.hostname) && parsed.pathname.startsWith('/api/apps/auth')) return true;
    if (parsed.hostname === 'restorebraine.base44.app' && parsed.pathname.startsWith('/api/apps/auth')) return true;
  } catch {}
  return false;
};

const captureTokenFromUrl = async (url) => {
  try {
    const parsed = new URL(url);
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
  window.location.replace(RESTOREBRAINE_FROM_URL);
};

const handleOAuthBrowserUrl = async (url) => {
  if (!url) return false;

  const token = await captureTokenFromUrl(url);
  if (token) {
    await finishOAuthLogin();
    return true;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'restorebraine.base44.app') {
      const stored = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (stored) {
        await finishOAuthLogin();
        return true;
      }
    }
    if (isBase44PlatformHost(parsed.hostname) && !parsed.pathname.startsWith('/api/apps/auth')) {
      const stored = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (stored) {
        await finishOAuthLogin();
        return true;
      }
    }
  } catch {}

  return false;
};

const attachOAuthCompletionListener = async () => {
  if (oauthListenerAttached) return;
  oauthListenerAttached = true;

  await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
    await handleOAuthBrowserUrl(event?.url);
  });

  await InAppBrowser.addListener('browserClosed', () => {
    const stored = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
    if (stored) window.location.replace(RESTOREBRAINE_FROM_URL);
  });

  await InAppBrowser.addListener('browserPageLoaded', async () => {
    const stored = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
    if (stored) await finishOAuthLogin();
  });
};

/** Google OAuth uses InAppBrowser — openInSystemBrowser requires options or it silently fails. */
export const openLoginInSystemBrowser = async (url = getGoogleOAuthUrl()) => {
  if (!isNativeShell()) {
    window.location.replace(url);
    return;
  }

  oauthListenerAttached = false;
  await attachOAuthCompletionListener();

  try {
    await InAppBrowser.openInWebView({ url, options: WEBVIEW_OPTIONS });
    return;
  } catch {
    // fall through
  }

  await InAppBrowser.openInSystemBrowser({ url, options: SYSTEM_BROWSER_OPTIONS });
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
          captureTokenFromUrl(parsed.href).then((token) => {
            if (token) window.location.replace(RESTOREBRAINE_FROM_URL);
          });
          return;
        }
        if (isBase44PlatformHost(parsed.hostname)) {
          window.location.replace(RESTOREBRAINE_FROM_URL);
          return;
        }
      } catch {}

      if (isAuthNavigationUrl(url)) {
        openLoginInSystemBrowser(getGoogleOAuthUrl());
        return;
      }
      return original.call(this, url);
    };
  });
};

export const installNativeGoogleOAuthBrowser = () => {
  if (typeof window === 'undefined' || window.__restorebraineGoogleOAuthBrowserInstalled) return;
  window.__restorebraineGoogleOAuthBrowserInstalled = true;

  installLocationNavigationGuard();

  const originalOpen = window.open;
  window.open = function openWithSystemBrowser(url, target, features) {
    if (typeof url === 'string' && url.length > 0) {
      if (isAuthNavigationUrl(url)) {
        openLoginInSystemBrowser(getGoogleOAuthUrl());
        return window;
      }
      window.location.assign(url);
      return window;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };
};
