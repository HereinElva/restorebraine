import { redirectNativeToHostedApp } from '@/lib/native-hosted-redirect';
import { installNativeOAuthFix } from '@/lib/native-oauth-fix';

function showBootstrapError(error) {
  const message = error?.message || String(error);
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,sans-serif;background:#fef2f2;">
      <div style="max-width:420px;background:white;border-radius:16px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 8px;font-size:20px;color:#991b1b;">Restorebraine failed to start</h1>
        <p style="margin:0;color:#444;font-size:14px;">${message}</p>
      </div>
    </div>`;
  console.error('Restorebraine bootstrap failed', error);
}

async function bootstrapApp() {
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

  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Missing #root element in index.html');
  }

  ReactDOM.createRoot(root).render(<App />);
}

bootstrapApp().catch(showBootstrapError);

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
