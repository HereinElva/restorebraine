import { navigateToGallery } from '@/lib/gallery-nav';
import { resetAppScrollPosition } from '@/lib/scroll-reset';

/** Account → Gallery: scroll reset + gallery refresh on bundled iOS WebView. */
export async function navigateToGalleryFromAccount(navigate, { popBack, resumeActiveSession } = {}) {
  resetAppScrollPosition();
  await navigateToGallery(navigate, { popBack, resumeActiveSession });
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
