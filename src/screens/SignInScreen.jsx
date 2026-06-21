import { useEffect, useState } from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { getGoogleOAuthUrl } from '@/lib/auth-urls';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import './sign-in.css';

async function startGoogleSignIn({ clearSignedOut = false } = {}) {
  if (clearSignedOut) {
    try {
      localStorage.removeItem('b44_signed_out');
    } catch {
      /* ignore */
    }
  }

  const oauthUrl = getGoogleOAuthUrl();
  if (isNativeShell()) {
    await openLoginInSystemBrowser(oauthUrl, 'google');
    return;
  }
  window.location.href = oauthUrl;
}

function GoogleButton({ clearSignedOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <>
      {error ? <p className="rb-signin-error">{error}</p> : null}
      <button
        type="button"
        id="restorebraine-google-btn"
        className="rb-signin-google"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await startGoogleSignIn({ clearSignedOut });
          } catch (err) {
            setError(err?.message || 'Could not open sign in.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Opening sign in…' : 'Continue with Google'}
      </button>
    </>
  );
}

/**
 * Single login screen for web + Capacitor bundled native.
 * No logo. No Base44 multi-provider page. Google OAuth only.
 */
export default function SignInScreen({ clearSignedOut = false }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

  const showBuildTag = LOCAL_NATIVE_BUNDLE && isNativeShell();

  return (
    <main
      id="restorebraine-signin"
      className="rb-signin"
      data-rb-auth="sign-in-v4"
      data-rb-build={BUILD_NUMBER}
    >
      <section className="rb-signin-card">
        <h1 className="rb-signin-title">Restorebraine</h1>
        {showBuildTag ? (
          <p className="rb-signin-tag">Native bundle · v{BUILD_NUMBER}</p>
        ) : null}
        <GoogleButton clearSignedOut={clearSignedOut} />
      </section>
      {isNativeShell() ? <NativeDebugBadge /> : null}
    </main>
  );
}

export const hasStoredSessionToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return false;
    return Boolean(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};
