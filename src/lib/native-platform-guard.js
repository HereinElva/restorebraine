export const RESTOREBRAINE_FROM_URL = 'https://restorebraine.base44.app';
export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';

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

/** Native must never stay on Base44 platform — capture token if present, then redirect. */
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

export const hideBase44EditorWidget = () => {
  if (typeof document === 'undefined') return;

  const hideMatchingNodes = (root = document.body) => {
    if (!root?.querySelectorAll) return;

    root.querySelectorAll('button, a, div, span, p').forEach((node) => {
      const text = (node.textContent || '').trim();
      if (/edit with base\s*44/i.test(text) && text.length < 40) {
        let container = node.closest('div');
        if (container) container.style.setProperty('display', 'none', 'important');
        else node.style.setProperty('display', 'none', 'important');
      }
    });
  };

  hideMatchingNodes();

  if (window.__restorebraineEditorObserver) return;
  window.__restorebraineEditorObserver = new MutationObserver(() => hideMatchingNodes());
  window.__restorebraineEditorObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

export const interceptNativeSignInClicks = () => {
  if (typeof document === 'undefined' || window.__restorebraineSignInInterceptor) return;
  window.__restorebraineSignInInterceptor = true;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest(
        'button, a, [role="button"], div[data-provider], [data-testid*="google"], [class*="google"], [id*="google"]'
      );
      if (!target) return;

      const label = (target.textContent || '').trim();
      const href = target.href || target.getAttribute?.('href') || '';
      const isGoogle = /google/i.test(label) || /google/i.test(href) || /auth\/login/i.test(href);
      const isSignIn = /continue with|sign in with|sign in|^log in$/i.test(label) || /auth\/login/i.test(href);
      if (!isGoogle && !isSignIn) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const loginUrl = isGoogle ? getGoogleOAuthUrl() : getAppScopedLoginUrl();
      import('@/lib/native-google-oauth').then(({ openLoginInSystemBrowser }) => {
        openLoginInSystemBrowser(loginUrl);
      });
    },
    true
  );
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
    }
  });
  setInterval(() => {
    guardPlatformNavigation();
    guardGoogleOAuthInWebView();
  }, 1000);
};
