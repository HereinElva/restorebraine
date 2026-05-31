export const RESTOREBRAINE_FROM_URL = 'https://restorebraine.base44.app';
export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
/** Base44 only allows https:// restorebraine.base44.app as OAuth redirect — not custom schemes. */
export const NATIVE_OAUTH_CALLBACK = 'https://restorebraine.base44.app';

const PLATFORM_HOSTS = new Set(['app.base44.com', 'base44.com']);

export const isBase44PlatformHost = (hostname) => PLATFORM_HOSTS.has(hostname);

export const getAppScopedLoginUrl = () => {
  const params = new URLSearchParams({
    from_url: RESTOREBRAINE_FROM_URL,
    app_id: BASE44_APP_ID,
    prompt: 'select_account',
  });
  return `${RESTOREBRAINE_FROM_URL}/login?${params.toString()}`;
};

export const getGoogleOAuthUrl = () => {
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: RESTOREBRAINE_FROM_URL,
  });
  return `${RESTOREBRAINE_FROM_URL}/api/apps/auth/login?${params.toString()}`;
};

export const getProviderOAuthUrl = (label = '') => {
  if (/apple/i.test(label)) {
    const params = new URLSearchParams({ app_id: BASE44_APP_ID, from_url: RESTOREBRAINE_FROM_URL });
    return `${RESTOREBRAINE_FROM_URL}/api/apps/auth/apple/login?${params.toString()}`;
  }
  if (/microsoft/i.test(label)) {
    const params = new URLSearchParams({ app_id: BASE44_APP_ID, from_url: RESTOREBRAINE_FROM_URL });
    return `${RESTOREBRAINE_FROM_URL}/api/apps/auth/microsoft/login?${params.toString()}`;
  }
  if (/google/i.test(label)) return getGoogleOAuthUrl();
  return getAppScopedLoginUrl();
};

export const guardPlatformNavigation = () => {
  if (typeof window === 'undefined') return;
  const { hostname, search } = window.location;
  if (!isBase44PlatformHost(hostname)) return;
  const token = new URLSearchParams(search).get('access_token');
  if (token) {
    import('@/lib/session-bootstrap').then(({ persistSessionToNativeStorage }) => {
      persistSessionToNativeStorage(token);
    });
  }
  window.location.replace(RESTOREBRAINE_FROM_URL);
};

const blockBase44BadgeScript = () => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('script[src*="badge.js"]').forEach((node) => node.remove());
};

export const hideBase44EditorWidget = () => {
  if (typeof document === 'undefined') return;
  blockBase44BadgeScript();
  if (!document.getElementById('rb-hide-base44')) {
    const style = document.createElement('style');
    style.id = 'rb-hide-base44';
    style.textContent = '[href*="app.base44.com"], iframe[src*="base44"], script[src*="badge.js"] { display:none !important; visibility:hidden !important; pointer-events:none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }
  const hideMatchingNodes = (root = document.body) => {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('button, a, div, span, p, iframe').forEach((node) => {
      if (node.id === 'rb-native-stamp') return;
      const text = (node.textContent || '').trim();
      if (/edit with base\s*44/i.test(text) && text.length < 60) {
        let el = node;
        for (let i = 0; i < 8 && el && el !== document.body; i += 1) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el = el.parentElement;
        }
      }
    });
  };
  hideMatchingNodes();
  if (window.__restorebraineEditorObserver) return;
  window.__restorebraineEditorObserver = new MutationObserver(() => {
    blockBase44BadgeScript();
    hideMatchingNodes();
  });
  window.__restorebraineEditorObserver.observe(document.documentElement, { childList: true, subtree: true });
};

export const interceptNativeSignInClicks = () => {
  if (typeof document === 'undefined' || window.__restorebraineSignInInterceptor) return;
  window.__restorebraineSignInInterceptor = true;
  document.addEventListener('click', (event) => {
    const target = event.target.closest('button, a, [role="button"], div[role="button"], [data-provider]');
    if (!target) return;
    const label = (target.textContent || '').trim();
    const href = target.href || target.getAttribute?.('href') || '';
    const isProvider = /continue with google|continue with apple|continue with microsoft|sign in with email|sign in with google|sign in with apple|sign in with microsoft/i.test(label);
    const isAuthLink = /auth\/login|auth\/apple|auth\/microsoft/i.test(href);
    if (!isProvider && !isAuthLink) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(getProviderOAuthUrl(label));
    });
  }, true);
};

export const guardGoogleOAuthInWebView = () => {
  if (typeof window === 'undefined') return;
  if (/accounts\.google\.com/i.test(window.location.hostname)) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      window.history.length > 1 ? window.history.back() : window.location.replace(RESTOREBRAINE_FROM_URL);
      openLoginInSystemBrowser(getGoogleOAuthUrl());
    });
  }
};

export const installNativePlatformGuard = () => {
  if (typeof window === 'undefined' || window.__restorebrainePlatformGuardInstalled) return;
  window.__restorebrainePlatformGuardInstalled = true;
  guardPlatformNavigation();
  hideBase44EditorWidget();
  interceptNativeSignInClicks();
  guardGoogleOAuthInWebView();
  window.addEventListener('popstate', () => {
    guardPlatformNavigation();
    guardGoogleOAuthInWebView();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      guardPlatformNavigation();
      guardGoogleOAuthInWebView();
      hideBase44EditorWidget();
    }
  });
  setInterval(() => {
    guardPlatformNavigation();
    guardGoogleOAuthInWebView();
    hideBase44EditorWidget();
  }, 500);
};
