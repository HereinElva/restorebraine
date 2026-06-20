import { redirectNativeToHostedApp } from '@/lib/native-hosted-redirect';
import { installNativeOAuthFix } from '@/lib/native-oauth-fix';
import { redirectBrokenCustomDomainLogin } from '@/lib/auth-urls';

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
  if (redirectBrokenCustomDomainLogin()) {
    return;
  }

  installNativeOAuthFix();

  if (redirectNativeToHostedApp()) {
    return;
  }

  const { restoreSessionFromNativeStorage, installNativeSessionPersistence } = await import('@/lib/session-bootstrap');
  await restoreSessionFromNativeStorage();
  await installNativeSessionPersistence();

  const { default: React } = await import('react');
  const { default: ReactDOM } = await import('react-dom/client');
  const { default: App } = await import('@/App.jsx');
  await import('@/index.css');

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
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
