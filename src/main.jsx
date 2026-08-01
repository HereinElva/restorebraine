import { redirectNativeToHostedApp, isNativeShell } from '@/lib/native-hosted-redirect';
import { installNativeOAuthFix } from '@/lib/native-oauth-fix';
import { redirectBrokenCustomDomainLogin } from '@/lib/auth-urls';

const BOOTSTRAP_TIMEOUT_MS = 15000;

function showBootstrapError(message) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#fff;">
      <div style="max-width:420px;text-align:center;">
        <h1 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">Restorebraine failed to start</h1>
        <p style="font-size:14px;color:#666;margin-bottom:16px;">${message}</p>
        <button onclick="location.reload()" style="padding:12px 20px;border:none;border-radius:12px;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer;">
          Retry
        </button>
      </div>
    </div>
  `;
}

async function warmNativeSessionForLocalBundle() {
  try {
    const { waitForCapacitorBridge, withTimeout } = await import('@/lib/capacitor-ready');
    await waitForCapacitorBridge(6000);
    const { restoreSessionFromNativeStorage, installNativeSessionPersistence } = await import('@/lib/session-bootstrap');
    await withTimeout(restoreSessionFromNativeStorage(), 4000, 'restoreSession');
    installNativeSessionPersistence().catch((error) => {
      console.warn('Native session listeners unavailable:', error);
    });
  } catch (error) {
    console.warn('Native session warm-up skipped:', error);
  }
}

async function bootstrapApp() {
  if (redirectBrokenCustomDomainLogin()) {
    return;
  }

  installNativeOAuthFix();

  if (redirectNativeToHostedApp()) {
    return;
  }

  // Warm session in background — must not block React mount (white screen if bridge is slow)
  if (isNativeShell()) {
    warmNativeSessionForLocalBundle().catch(() => {});
  }

  const [{ default: React }, { default: ReactDOM }, { default: App }] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('@/App.jsx'),
  ]);
  await import('@/index.css');

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  window.__rbBooted = true;
  const fb = document.getElementById('rb-boot-fallback');
  if (fb) fb.remove();

  if (isNativeShell()) {
    import('@/lib/native-google-oauth').then(({ installNativeOAuthListeners }) => {
      requestAnimationFrame(() => {
        void installNativeOAuthListeners();
      });
    });
  }
}

let bootstrapFinished = false;
const bootstrapTimer = window.setTimeout(() => {
  if (bootstrapFinished) return;
  showBootstrapError('Startup is taking too long. Check your network connection and tap Retry.');
}, BOOTSTRAP_TIMEOUT_MS);

bootstrapApp()
  .then(() => {
    bootstrapFinished = true;
    window.clearTimeout(bootstrapTimer);
  })
  .catch((error) => {
    bootstrapFinished = true;
    window.clearTimeout(bootstrapTimer);
    console.error('Restorebraine bootstrap failed:', error);
    showBootstrapError(error?.message || 'Unknown startup error');
  });

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
