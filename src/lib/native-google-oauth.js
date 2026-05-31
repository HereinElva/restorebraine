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
};

const waitForInAppBrowser = (maxAttempts = 60, intervalMs = 100) =>
  new Promise((resolve) => {
    const tryGet = (attempt = 0) => {
      const ib = window.Capacitor?.Plugins?.InAppBrowser;
      if (ib) {
        resolve(ib);
        return;
      }
      if (attempt >= maxAttempts) {
        resolve(null);
        return;
      }
      setTimeout(() => tryGet(attempt + 1), intervalMs);
    };
    tryGet();
  });

/** Google OAuth uses SFSafariViewController. Callback passes through app.base44.com — we capture the token and return. */
export const openLoginInSystemBrowser = async (url = getGoogleOAuthUrl()) => {
  if (!isNativeShell()) {
    window.location.replace(url);
    return;
  }

  oauthListenerAttached = false;
  await attachOAuthCompletionListener();
  const ib = await waitForInAppBrowser();
  if (!ib) {
    console.warn('InAppBrowser plugin unavailable; refusing WebView OAuth fallback');
    return;
  }
  await ib.openInSystemBrowser({ url });
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
