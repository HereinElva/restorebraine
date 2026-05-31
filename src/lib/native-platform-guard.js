export const RESTOREBRAINE_FROM_URL = 'https://restorebraine.base44.app';
export const BASE44_APP_ID = '68fdc5f42768c4d045fe1bac';

export const getAppScopedLoginUrl = () => {
  const params = new URLSearchParams({
    from_url: RESTOREBRAINE_FROM_URL,
    app_id: BASE44_APP_ID,
    prompt: 'select_account',
  });
  return `https://app.base44.com/login?${params.toString()}`;
};

const ALLOWED_PLATFORM_PATHS = ['/login', '/api/apps/auth'];

export const isAllowedPlatformPath = (pathname) =>
  ALLOWED_PLATFORM_PATHS.some((prefix) => pathname.startsWith(prefix));

/** Block Base44 builder dashboard — native users must use app-scoped login only. */
export const guardPlatformNavigation = () => {
  if (typeof window === 'undefined') return;

  const { hostname, pathname, search } = window.location;
  if (hostname !== 'app.base44.com') return;

  if (isAllowedPlatformPath(pathname)) return;

  const params = new URLSearchParams(search);
  if (params.has('access_token')) return;

  window.location.replace(getAppScopedLoginUrl());
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

  const loginUrl = getAppScopedLoginUrl();
  const pattern = /continue with google|continue with apple|continue with microsoft|sign in with email|^sign in$/i;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest('button, a, [role="button"]');
      if (!target) return;

      const label = (target.textContent || '').trim();
      if (!pattern.test(label)) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.replace(loginUrl);
    },
    true
  );
};

export const installNativePlatformGuard = () => {
  if (typeof window === 'undefined' || window.__restorebrainePlatformGuardInstalled) return;
  window.__restorebrainePlatformGuardInstalled = true;

  guardPlatformNavigation();
  hideBase44EditorWidget();
  interceptNativeSignInClicks();

  window.addEventListener('popstate', guardPlatformNavigation);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') guardPlatformNavigation();
  });
  setInterval(guardPlatformNavigation, 1000);
};
