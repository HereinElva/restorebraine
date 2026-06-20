/**
 * v4-core: keep the Capacitor WebView on capacitor://localhost — never load hosted restorebraine.base44.app.
 */
import { isAppHost, DEFAULT_APP_ORIGIN } from '@/lib/app-domains';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isNativeShell, getNativeWebViewHome } from '@/lib/native-hosted-redirect';
import { isBase44PlatformHost, hideBase44EditorWidget } from '@/lib/native-platform-guard';

export const isExternalAppUrl = (url) => {
  try {
    const parsed = new URL(String(url), typeof window !== 'undefined' ? window.location.href : DEFAULT_APP_ORIGIN);
    if (parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:') return false;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
    return isAppHost(parsed.hostname) || isBase44PlatformHost(parsed.hostname);
  } catch {
    return false;
  }
};

export const redirectToNativeBundleHome = async (url) => {
  if (url) {
    try {
      const parsed = new URL(String(url), DEFAULT_APP_ORIGIN);
      const token = parsed.searchParams.get('access_token');
      if (token) {
        const { persistSessionToNativeStorage } = await import('@/lib/session-bootstrap');
        await persistSessionToNativeStorage(token);
        window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
      }
    } catch {}
  }
  window.location.replace(getNativeWebViewHome());
};

/** If WebView landed on hosted Base44 URL, bounce back to bundled shell. */
export const enforceNativeBundleOrigin = () => {
  if (!LOCAL_NATIVE_BUNDLE || !isNativeShell() || typeof window === 'undefined') return;
  const { protocol, hostname, href } = window.location;
  if (protocol === 'capacitor:' || protocol === 'ionic:') return;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return;
  if (isAppHost(hostname) || isBase44PlatformHost(hostname)) {
    redirectToNativeBundleHome(href);
  }
};

export const installNativeBundleShellGuard = () => {
  if (typeof window === 'undefined' || window.__restorebraineBundleShellGuardInstalled) return;
  if (!LOCAL_NATIVE_BUNDLE || !isNativeShell()) return;
  window.__restorebraineBundleShellGuardInstalled = true;

  enforceNativeBundleOrigin();
  hideBase44EditorWidget();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      enforceNativeBundleOrigin();
      hideBase44EditorWidget();
    }
  });

  window.addEventListener('popstate', () => {
    enforceNativeBundleOrigin();
    hideBase44EditorWidget();
  });

  setInterval(() => {
    enforceNativeBundleOrigin();
    hideBase44EditorWidget();
  }, 800);
};

export const shouldBlockExternalNavigation = (url) =>
  LOCAL_NATIVE_BUNDLE && isNativeShell() && isExternalAppUrl(url);
