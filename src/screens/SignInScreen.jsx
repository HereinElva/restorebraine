import { useEffect, useState } from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { signInWithGoogle } from '@/lib/sign-in-with-google';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import './sign-in.css';

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
            await signInWithGoogle({ clearSignedOut });
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

/** Single login for web + native (hosted WebView and bundled). No logo. Google only. */
export default function SignInScreen({ clearSignedOut = false }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

  const showNativeTag = isNativeShell() && LOCAL_NATIVE_BUNDLE && !isHostedAppOrigin();

  return (
    <main
      id="restorebraine-signin"
      className="rb-signin"
      data-rb-auth="sign-in-v4"
      data-rb-build={BUILD_NUMBER}
    >
      <section className="rb-signin-card">
        <h1 className="rb-signin-title">Restorebraine</h1>
        {showNativeTag ? (
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
