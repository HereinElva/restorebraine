import { Capacitor } from '@capacitor/core';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { isAppHost } from '@/lib/app-domains';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getStripeReturnBaseUrl } from '@/lib/native-platform';

const STRIPE_COMPLETE_EVENT = 'restorebraine-stripe-complete';
const STRIPE_REQUEST_EVENT = 'restorebraine-stripe-checkout';
const STRIPE_SHEET_TIMEOUT_MS = 10 * 60 * 1000;
const PLUGIN_WAIT_MS = 6000;

const WEBVIEW_OPTIONS = {
  showURL: false,
  showToolbar: true,
  clearCache: false,
  clearSessionCache: false,
  closeButtonText: 'Cancel',
  toolbarPosition: 0,
  showNavigationButtons: false,
  iOS: { viewStyle: 2, animationEffect: 2, allowsBackForwardNavigationGestures: false },
  android: { allowZoom: false, hardwareBack: true },
};

function shouldUseInAppStripeSheet() {
  try {
    if (isNativeShell()) return true;
    if (typeof window !== 'undefined' && window.Capacitor?.nativePromise) return true;
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function parseStripeReturn(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, getStripeReturnBaseUrl());
    if (!isAppHost(parsed.hostname)) return null;
    const path = parsed.pathname.toLowerCase();
    if (path.includes('paymentsuccess')) {
      return { type: 'success', sessionId: parsed.searchParams.get('session_id') };
    }
    if (path.includes('upload')) {
      return { type: 'cancel' };
    }
  } catch {}
  return null;
}

/** Wait for Capacitor bridge — ES import alone is often too early on Android. */
async function getInAppBrowserPlugin() {
  const deadline = Date.now() + PLUGIN_WAIT_MS;
  while (Date.now() < deadline) {
    const plugin = window.Capacitor?.Plugins?.InAppBrowser;
    if (plugin?.openInWebView) return plugin;
    if (InAppBrowser?.openInWebView) return InAppBrowser;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('In-app payment unavailable — close and reopen the app, then try again.');
}

async function openStripeInNativeSheet(checkoutUrl) {
  if (!checkoutUrl) throw new Error('Missing Stripe checkout URL');

  const ib = await getInAppBrowserPlugin();
  if (!ib?.openInWebView && !Capacitor.nativePromise) {
    throw new Error('In-app payment panel unavailable — update the app from Play Store.');
  }

  let finished = false;
  const listeners = [];

  const cleanup = async () => {
    for (const listener of listeners) {
      try {
        await listener.remove();
      } catch {}
    }
    listeners.length = 0;
    await InAppBrowser.close().catch(() => {});
  };

  const complete = async (outcome) => {
    if (finished) return;
    finished = true;
    await cleanup();
    if (outcome?.type === 'success' && outcome.sessionId) {
      const base = getStripeReturnBaseUrl();
      const successUrl = `${base}/PaymentSuccess?session_id=${encodeURIComponent(outcome.sessionId)}`;
      window.location.replace(successUrl);
    }
    window.dispatchEvent(new CustomEvent(STRIPE_COMPLETE_EVENT, { detail: outcome }));
  };

  const onNavigation = async (event) => {
    const outcome = parseStripeReturn(event?.url);
    if (outcome) await complete(outcome);
  };

  listeners.push(await ib.addListener('browserPageNavigationCompleted', onNavigation));
  listeners.push(await ib.addListener('browserPageLoaded', onNavigation));
  listeners.push(await ib.addListener('browserClosed', () => complete({ type: 'closed' })));

  await (ib?.openInWebView
    ? ib.openInWebView({ url: checkoutUrl, options: WEBVIEW_OPTIONS })
    : Capacitor.nativePromise('InAppBrowser', 'openInWebView', {
        url: checkoutUrl,
        options: WEBVIEW_OPTIONS,
      }));

  await new Promise((resolve) => {
    const onDone = () => {
      window.removeEventListener(STRIPE_COMPLETE_EVENT, onDone);
      resolve();
    };
    window.addEventListener(STRIPE_COMPLETE_EVENT, onDone);
    setTimeout(() => {
      if (!finished) void complete({ type: 'timeout' });
      resolve();
    }, STRIPE_SHEET_TIMEOUT_MS);
  });
}

/** Open Stripe Checkout — in-app WebView on native, same tab on web. */
export async function openStripeCheckout(checkoutUrl) {
  if (!checkoutUrl) throw new Error('Missing Stripe checkout URL');

  if (shouldUseInAppStripeSheet()) {
    await openStripeInNativeSheet(checkoutUrl);
    return;
  }

  window.location.assign(checkoutUrl);
}

let stripeListenerInstalled = false;

/** Listen for early native guard events from index.html / stripe-native-guard.js */
export function installStripeCheckoutNativeListener() {
  if (typeof window === 'undefined' || stripeListenerInstalled || !shouldUseInAppStripeSheet()) return;
  stripeListenerInstalled = true;

  window.addEventListener(STRIPE_REQUEST_EVENT, (event) => {
    const url = event?.detail?.url;
    if (!url) return;
    void openStripeInNativeSheet(url).catch((error) => {
      console.error('Stripe in-app checkout failed:', error);
      if (typeof window !== 'undefined') {
        window.__restorebraineLastStripeError = error?.message || String(error);
      }
    });
  });
}

/** Refresh billing state when returning to the app after Stripe checkout. */
export function installStripeReturnRefresh(onRefresh) {
  if (typeof onRefresh !== 'function') return () => {};

  let remove = () => {};

  (async () => {
    if (!Capacitor.isNativePlatform()) {
      const onVisible = () => {
        if (document.visibilityState === 'visible') onRefresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      remove = () => document.removeEventListener('visibilitychange', onVisible);
      return;
    }

    try {
      const { App } = await import('@capacitor/app');
      const sub = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) onRefresh();
      });
      remove = () => sub.remove();
    } catch {
      const onVisible = () => {
        if (document.visibilityState === 'visible') onRefresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      remove = () => document.removeEventListener('visibilitychange', onVisible);
    }
  })();

  return () => remove();
}
