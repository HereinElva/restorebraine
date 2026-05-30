import { redirectNativeToHostedApp } from '@/lib/native-hosted-redirect';

async function bootstrapApp() {
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

bootstrapApp();

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
