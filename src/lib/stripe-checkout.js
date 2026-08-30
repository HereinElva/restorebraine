import { Capacitor } from '@capacitor/core';
import { isAppHost } from '@/lib/app-domains';
import { getStripeReturnBaseUrl, isNativeShell } from '@/lib/native-platform';

const STRIPE_COMPLETE_EVENT = 'restorebraine-stripe-complete';
const STRIPE_SHEET_TIMEOUT_MS = 10 * 60 * 1000;

const NATIVE_BROWSER_OPTIONS = {
  dismissButtonStyle: 'close',
  showTitle: true,
  showURL: false,
};

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

async function getInAppBrowserPlugin() {
  const mod = await import('@capacitor/inappbrowser');
  return mod.InAppBrowser;
}

async function openStripeInNativeSheet(checkoutUrl) {
  const InAppBrowser = await getInAppBrowserPlugin();
  // WebView first — stays inside the app. System browser (Custom Tab / Safari sheet) feels like leaving the app.
  const openSheet = InAppBrowser.openInWebView || InAppBrowser.openInSystemBrowser;
  if (!openSheet) {
    throw new Error('InAppBrowser sheet unavailable');
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
      window.location.assign(
        `${base}/PaymentSuccess?session_id=${encodeURIComponent(outcome.sessionId)}`,
      );
    }
    window.dispatchEvent(new CustomEvent(STRIPE_COMPLETE_EVENT, { detail: outcome }));
  };

  const onNavigation = async (event) => {
    const outcome = parseStripeReturn(event?.url);
    if (outcome) await complete(outcome);
  };

  listeners.push(await InAppBrowser.addListener('browserPageNavigationCompleted', onNavigation));
  listeners.push(await InAppBrowser.addListener('browserPageLoaded', onNavigation));
  listeners.push(await InAppBrowser.addListener('browserClosed', () => complete({ type: 'closed' })));

  await openSheet.call(InAppBrowser, { url: checkoutUrl, options: NATIVE_BROWSER_OPTIONS });

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

/** Open Stripe Checkout — in-app sheet on native, same tab on web. */
export async function openStripeCheckout(checkoutUrl) {
  if (!checkoutUrl) throw new Error('Missing Stripe checkout URL');

  if (isNativeShell()) {
    try {
      await openStripeInNativeSheet(checkoutUrl);
      return;
    } catch (error) {
      console.warn('Native Stripe sheet failed, using full navigation', error);
    }
  }

  window.location.assign(checkoutUrl);
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
