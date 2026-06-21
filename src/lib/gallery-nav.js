import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';
import { resetAppScrollPosition } from '@/lib/scroll-reset';

export const GALLERY_PATH = createPageUrl('Gallery');
const SIGNED_OUT_KEY = 'b44_signed_out';

export function isGalleryPath(pathname = '') {
  const path = pathname.toLowerCase();
  return path === '/' || path === GALLERY_PATH;
}

export async function persistActiveSession() {
  const token =
    localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (!token) return null;

  try {
    localStorage.removeItem(SIGNED_OUT_KEY);
    base44.auth.setToken(token, false);
    await persistSessionToNativeStorage(token);
  } catch {
    // Keep navigation working even if persistence fails
  }

  return token;
}

export function navigateToGallery(navigate, { popBack, resumeActiveSession } = {}) {
  popBack?.();
  resetAppScrollPosition();
  navigate('/', { replace: true });
  void persistActiveSession();
  void resumeActiveSession?.();
  window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: {} }));
  requestAnimationFrame(() => {
    resetAppScrollPosition();
    const path = (window.location.pathname || '/').toLowerCase();
    if (path !== '/' && !path.includes('gallery')) {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}
