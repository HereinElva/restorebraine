export const RESTOREBRAINE_FROM_URL = 'https://restorebraine.base44.app';
export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';
export const BASE44_PLATFORM_URL = 'https://app.base44.com';
/** Base44 only allows https://restorebraine.base44.app as OAuth redirect — not custom schemes. */
export const NATIVE_OAUTH_CALLBACK = RESTOREBRAINE_FROM_URL;

const PLATFORM_HOSTS = new Set(['app.base44.com', 'base44.com']);

export const isBase44PlatformHost = (hostname) => PLATFORM_HOSTS.has(hostname);

const providerFromPath = (pathname = '') => {
  if (/\/apple\//i.test(pathname)) return 'apple';
  if (/\/microsoft\//i.test(pathname)) return 'microsoft';
  return 'google';
};

const providerFromLabel = (label = '') => {
  if (/apple/i.test(label)) return 'apple';
  if (/microsoft/i.test(label)) return 'microsoft';
  return 'google';
};

export const getCanonicalOAuthUrl = (provider = 'google') => {
  const path = provider === 'google'
    ? '/api/apps/auth/login'
    : `/api/apps/auth/${provider}/login`;
  const params = new URLSearchParams({
    app_id: BASE44_APP_ID,
    from_url: RESTOREBRAINE_FROM_URL,
  });
  return `${BASE44_PLATFORM_URL}${path}?${params.toString()}`;
};

/** Force a valid OAuth URL — blocks capacitor://, restorebraine://, and app.base44.com from_url values. */
export const normalizeAuthUrl = (rawUrl, providerHint) => {
  try {
    const parsed = new URL(String(rawUrl || ''), typeof window !== 'undefined' ? window.location.href : RESTOREBRAINE_FROM_URL);
    if (!isAuthNavigationUrl(rawUrl) && !providerHint) return String(rawUrl);
    const provider = providerHint || providerFromPath(parsed.pathname);
    return getCanonicalOAuthUrl(provider);
  } catch {
    return getCanonicalOAuthUrl(providerHint || 'google');
  }
};

export const getAppScopedLoginUrl = () => {
  const params = new URLSearchParams({
    from_url: RESTOREBRAINE_FROM_URL,
    app_id: BASE44_APP_ID,
    prompt: 'select_account',
  });
  return `${RESTOREBRAINE_FROM_URL}/login?${params.toString()}`;
};

export const getGoogleOAuthUrl = () => getCanonicalOAuthUrl('google');

export const getProviderOAuthUrl = (label = '') => getCanonicalOAuthUrl(providerFromLabel(label));

export const isAuthNavigationUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(String(url), typeof window !== 'undefined' ? window.location.href : RESTOREBRAINE_FROM_URL);
    if (/accounts\.google\.com|google\.com\/o\/oauth|oauth2\.googleapis\.com/i.test(parsed.href)) return true;
    if (isBase44PlatformHost(parsed.hostname) && parsed.pathname.startsWith('/api/apps/auth')) return true;
    if (parsed.hostname === 'restorebraine.base44.app' && parsed.pathname.startsWith('/api/apps/auth')) return true;
  } catch {}
  return false;
};


export const isAuthLogoutUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(String(url), typeof window !== 'undefined' ? window.location.href : RESTOREBRAINE_FROM_URL);
    return /\/api\/apps\/auth\/logout/i.test(parsed.pathname);
  } catch {}
  return false;
};

export const guardSignedOutLoginPage = () => {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem('b44_signed_out') !== '1') return;
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/login') {
      window.location.replace(`${RESTOREBRAINE_FROM_URL}/`);
    }
  } catch {}
};

export const guardPlatformNavigation = () => {
  if (typeof window === 'undefined') return;
  const { hostname, search, pathname } = window.location;
  if (!isBase44PlatformHost(hostname)) return;
  const token = new URLSearchParams(search).get('access_token');
  if (token) {
    import('@/lib/session-bootstrap').then(({ persistSessionToNativeStorage }) => {
      persistSessionToNativeStorage(token);
    });
  }
  if (pathname.startsWith('/api/apps/auth')) return;
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
    const label = (target.textContent || '').replace(/\s+/g, ' ').trim();
    const href = target.href || target.getAttribute?.('href') || '';
    const isSignInButton = /^sign in$/i.test(label);
    const isProvider = /continue with google|continue with apple|continue with microsoft|sign in with email|sign in with google|sign in with apple|sign in with microsoft/i.test(label);
    const isAuthLink = /auth\/login|auth\/apple|auth\/microsoft|app\.base44\.com\/login/i.test(href);
    if (!isSignInButton && !isProvider && !isAuthLink) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    try { localStorage.removeItem('b44_signed_out'); } catch {}
    const provider = providerFromLabel(label);
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      openLoginInSystemBrowser(getCanonicalOAuthUrl(provider), provider);
    });
  }, true);
};

export const guardGoogleOAuthInWebView = () => {
  if (typeof window === 'undefined') return;
  if (/accounts\.google\.com/i.test(window.location.hostname)) {
    import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
      window.history.length > 1 ? window.history.back() : window.location.replace(RESTOREBRAINE_FROM_URL);
      openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
    });
  }
};

export const installNativePlatformGuard = () => {
  if (typeof window === 'undefined' || window.__restorebrainePlatformGuardInstalled) return;
  window.__restorebrainePlatformGuardInstalled = true;
  guardPlatformNavigation();
  guardSignedOutLoginPage();
  hideBase44EditorWidget();
  interceptNativeSignInClicks();
  guardGoogleOAuthInWebView();
  window.addEventListener('popstate', () => {
    guardPlatformNavigation();
    guardSignedOutLoginPage();
    guardGoogleOAuthInWebView();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      guardPlatformNavigation();
      guardSignedOutLoginPage();
      guardGoogleOAuthInWebView();
      hideBase44EditorWidget();
    }
  });
  setInterval(() => {
    guardPlatformNavigation();
    guardSignedOutLoginPage();
    guardGoogleOAuthInWebView();
    hideBase44EditorWidget();
  }, 500);
};
