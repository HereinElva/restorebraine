import { useState } from 'react';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { startGoogleSignIn } from '@/auth/googleSignIn';
import '@/auth/sign-in-screen.css';

function GoogleSignInControl({ clearSignedOut = false }) {
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  const onSignIn = async () => {
    if (busy) return;
    setErrorText('');
    setBusy(true);
    try {
      await startGoogleSignIn({ clearSignedOut });
    } catch (error) {
      console.error('Google sign-in failed', error);
      setErrorText(error?.message || 'Could not open sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {errorText ? <p className="rb-signin-error">{errorText}</p> : null}
      <button
        type="button"
        id="restorebraine-google-btn"
        className="rb-signin-google"
        onClick={onSignIn}
        disabled={busy}
      >
        {busy ? 'Opening sign in…' : 'Continue with Google'}
      </button>
    </>
  );
}

/** v4 sign-in gate — white card, title, Google only (no logo). */
export default function RestorebraineSignIn({ clearSignedOut = false }) {
  return (
    <main
      id="restorebraine-signin-shell"
      className="rb-signin-shell"
      data-rb-v4-auth="react"
      aria-label="Sign in to Restorebraine"
    >
      <div className="rb-signin-card">
        <h1 className="rb-signin-title">Restorebraine</h1>
        <GoogleSignInControl clearSignedOut={clearSignedOut} />
      </div>
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
