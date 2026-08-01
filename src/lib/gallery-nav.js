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

export async function navigateToGallery(navigate, { popBack, resumeActiveSession } = {}) {
  popBack?.();
  resetAppScrollPosition();
  void persistActiveSession();
  void resumeActiveSession?.();
  navigate('/', { replace: true });

  if (typeof window !== 'undefined') {
    const isNative =
      window.Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';
    if (isNative) {
      window.setTimeout(() => {
        const hash = (window.location.hash || '').toLowerCase();
        if (hash.includes('account') || hash.includes('upload')) {
          window.location.hash = '#/';
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        resetAppScrollPosition();
      }, 120);
    }
  }
}
