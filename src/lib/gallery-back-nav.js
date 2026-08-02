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

function isOnAccountRoute() {
  const hash = (window.location.hash || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase();
  return hash.includes('account') || path.includes('account');
}

/** Account → Gallery — sync nav with HashRouter / capacitor:// hard fallback. */
export function navigateToGalleryFromAccount(navigate, { popBack, resumeActiveSession } = {}) {
  popBack?.();
  resetAppScrollPosition();
  void persistActiveSession();
  void resumeActiveSession?.();
  try {
    window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: {} }));
  } catch {}

  navigate('/', { replace: true });

  if (isNativeWebView()) {
    window.setTimeout(() => {
      if (isOnAccountRoute()) {
        window.location.hash = '#/';
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      resetAppScrollPosition();
    }, 120);
  } else {
    requestAnimationFrame(() => {
      resetAppScrollPosition();
    });
  }
}
