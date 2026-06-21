import { persistActiveSession } from '@/lib/gallery-nav';
import { resetAppScrollPosition } from '@/lib/scroll-reset';

function isNativeWebView() {
  if (typeof window === 'undefined') return false;
  return (
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
  );
}

/** Account → Gallery — sync nav with iOS WebView hard fallback. */
export function navigateToGalleryFromAccount(navigate, { popBack, resumeActiveSession } = {}) {
  popBack?.();
  resetAppScrollPosition();
  void persistActiveSession();
  void resumeActiveSession?.();
  window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: {} }));

  navigate('/', { replace: true });

  if (isNativeWebView()) {
    window.setTimeout(() => {
      const path = (window.location.pathname || '').toLowerCase();
      if (path.includes('account')) {
        window.location.replace('/');
      }
    }, 120);
  } else {
    requestAnimationFrame(() => {
      resetAppScrollPosition();
      const path = (window.location.pathname || '/').toLowerCase();
      if (path !== '/' && !path.includes('gallery')) {
        window.history.replaceState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }
}
