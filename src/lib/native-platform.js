import { DEFAULT_APP_ORIGIN, isAppHost } from './app-domains';

/** Canonical hosted web app — Stripe checkout redirects here when origin is unknown. */
export const WEB_APP_URL = DEFAULT_APP_ORIGIN;

export const isNativeShell = () => {
  try {
    return typeof window !== 'undefined' && (
      window.Capacitor?.isNativePlatform?.() ||
      window.location?.protocol === 'capacitor:' ||
      window.location?.protocol === 'ionic:'
    );
  } catch {
    return false;
  }
};

/** True when running the deployed web app (browser or Capacitor loading hosted URL). */
export const isHostedWebApp = () => {
  try {
    if (typeof window === 'undefined') return false;
    return isAppHost(window.location.hostname);
  } catch {
    return false;
  }
};

/**
 * Stripe is synchronized with the hosted web app on any verified app domain.
 * Use Stripe whenever on the hosted web app — including the iOS app, which
 * loads that same URL in a WebView.
 */
export const shouldUseStripeCheckout = () => {
  if (isHostedWebApp()) return true;
  return !isNativeShell();
};

export function getStripeReturnBaseUrl() {
  if (typeof window === 'undefined') return WEB_APP_URL;
  if (isHostedWebApp()) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return WEB_APP_URL;
}
