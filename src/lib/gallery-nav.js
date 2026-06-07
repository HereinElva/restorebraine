import { createPageUrl } from '@/utils';
import { persistSessionToNativeStorage } from '@/lib/session-bootstrap';

export const GALLERY_PATH = createPageUrl('Gallery');

export function isGalleryPath(pathname = '') {
  const path = pathname.toLowerCase();
  return path === '/' || path === GALLERY_PATH;
}

export async function navigateToGallery(navigate, { popBack } = {}) {
  popBack?.();

  try {
    const token =
      localStorage.getItem('base44_access_token') || localStorage.getItem('token');
    if (token) {
      await persistSessionToNativeStorage(token);
    }
  } catch {
    // Continue navigation even if persistence fails
  }

  navigate(GALLERY_PATH, { replace: true });
}
