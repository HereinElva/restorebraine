import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
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

function markAppMounted() {
  window.__restorebraineAppMounted = true;
}

/** Build v4: mount React immediately — never block on Capacitor Preferences before first paint. */
async function bootstrapNativeLocal() {
  installNativeOAuthFix();

  const mountTimer = setTimeout(() => {
    if (!window.__restorebraineAppMounted) {
      showBootstrapError('Startup timed out. Run bash scripts/mac-ios-native-rebuild.sh then Clean Build Folder in Xcode.');
    }
  }, 10000);

  try {
    const [{ default: React }, { default: ReactDOM }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@/App.jsx'),
    ]);
    await import('@/index.css');

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    markAppMounted();
    clearTimeout(mountTimer);

    import('@/lib/session-bootstrap')
      .then(async ({ restoreSessionFromNativeStorage, installNativeSessionPersistence }) => {
        try {
          const token = await restoreSessionFromNativeStorage();
          if (token) {
            window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
          }
          await installNativeSessionPersistence();
        } catch (error) {
          console.warn('Background session bootstrap failed:', error);
        }
      })
      .catch((error) => {
        console.warn('Session bootstrap module unavailable:', error);
      });
  } catch (error) {
    clearTimeout(mountTimer);
    throw error;
  }
}

async function bootstrapApp() {
  if (redirectBrokenCustomDomainLogin()) {
    return;
  }

  if (LOCAL_NATIVE_BUNDLE) {
    await bootstrapNativeLocal();
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
    markAppMounted();
    clearTimeout(bootstrapTimeout);

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
