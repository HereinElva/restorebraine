import { redirectNativeToHostedApp } from '@/lib/native-hosted-redirect';
import { installNativeOAuthFix } from '@/lib/native-oauth-fix';
import { redirectBrokenCustomDomainLogin } from '@/lib/auth-urls';

function showBootstrapLoading() {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;background:linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8);padding:24px;">
      <div style="width:48px;height:48px;border:4px solid #e9d5ff;border-top-color:#9333ea;border-radius:50%;animation:rb-spin 0.8s linear infinite;"></div>
      <p style="font-size:15px;color:#666;margin:0;">Loading Restorebraine…</p>
    </div>
    <style>@keyframes rb-spin{to{transform:rotate(360deg)}}</style>
  `;
}

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

async function bootstrapApp() {
  showBootstrapLoading();

  if (redirectBrokenCustomDomainLogin()) {
    return;
  }

  installNativeOAuthFix();

  if (redirectNativeToHostedApp()) {
    return;
  }

  const bootstrapTimeout = setTimeout(() => {
    showBootstrapError('Startup timed out. Check your connection and tap Retry.');
  }, 15000);

  try {
    const [{ default: React }, { default: ReactDOM }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/App.jsx'),
    ]);
    await import('@/index.css');

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    clearTimeout(bootstrapTimeout);

    // Do not block first paint — AuthContext restores session on its own.
    import('@/lib/session-bootstrap')
      .then(async ({ restoreSessionFromNativeStorage, installNativeSessionPersistence }) => {
        try {
          await restoreSessionFromNativeStorage();
          await installNativeSessionPersistence();
        } catch (error) {
          console.warn('Background session bootstrap failed:', error);
        }
      })
      .catch((error) => {
        console.warn('Session bootstrap module unavailable:', error);
      });
  } catch (error) {
    clearTimeout(bootstrapTimeout);
    throw error;
  }
}

bootstrapApp().catch((error) => {
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
