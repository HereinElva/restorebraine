import { InAppBrowser } from '@capacitor/inappbrowser';
import { getAppScopedLoginUrl, getGoogleOAuthUrl, RESTOREBRAINE_FROM_URL, isBase44PlatformHost } from '@/lib/native-platform-guard';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { isNativeShell } from '@/lib/native-hosted-redirect';

const GOOGLE_OAUTH_PATTERN = /accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com/i;

export const isGoogleOAuthUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const { hostname, href } = new URL(url, window.location.href);
    return GOOGLE_OAUTH_PATTERN.test(hostname) || GOOGLE_OAUTH_PATTERN.test(href);
  } catch {
    return GOOGLE_OAUTH_PATTERN.test(url);
  }
};

let oauthListenerAttached = false;

const attachOAuthCompletionListener = async () => {
  if (oauthListenerAttached) return;
  oauthListenerAttached = true;

  await InAppBrowser.addListener('browserPageNavigationCompleted', async (event) => {
    const url = event?.url;
    if (!url) return;

    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'restorebraine.base44.app') return;

      const token = parsed.searchParams.get('access_token');
      if (!token) return;

      await persistSessionToNativeStorage(token);
      await InAppBrowser.close();
      window.location.replace(RESTOREBRAINE_FROM_URL);
    } catch (error) {
      console.warn('OAuth completion handling failed', error);
    }
  });

  await InAppBrowser.addListener('browserClosed', () => {
    window.location.replace(RESTOREBRAINE_FROM_URL);
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

/** Google OAuth must use SFSafariViewController — WKWebView gets 403 disallowed_useragent. */
export const openLoginInSystemBrowser = async (url = getAppScopedLoginUrl()) => {
  if (!isNativeShell()) {
    window.location.replace(url);
    return;
  }

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
      if (isGoogleOAuthUrl(url)) {
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
      if (isGoogleOAuthUrl(url)) {
        openLoginInSystemBrowser(getGoogleOAuthUrl());
        return window;
      }
      window.location.assign(url);
      return window;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };
};
