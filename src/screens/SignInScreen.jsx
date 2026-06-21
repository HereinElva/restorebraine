import { useEffect, useState } from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { signInWithGoogle, signInWithApple } from '@/lib/sign-in-with-provider';
import { useAuth } from '@/lib/AuthContext';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import './sign-in.css';

function OAuthButton({ id, label, className, onSignIn, clearSignedOut, busy, setBusy, setError }) {
  return (
    <button
      type="button"
      id={id}
      className={className}
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          await onSignIn({ clearSignedOut });
        } catch (err) {
          setError(err?.message || 'Could not open sign in.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Opening sign in…' : label}
    </button>
  );
}

function EmailSignIn({ clearSignedOut }) {
  const { loginWithEmailPassword, registerWithEmailPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    if (clearSignedOut) {
      try {
        localStorage.removeItem('b44_signed_out');
      } catch {
        /* ignore */
      }
    }
    try {
      if (mode === 'register') {
        await registerWithEmailPassword({ email, password, fullName: email.split('@')[0] || 'User' });
      } else {
        await loginWithEmailPassword({ email, password });
      }
    } catch (err) {
      setError(err?.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rb-signin-email" onSubmit={handleSubmit}>
      <input
        type="email"
        className="rb-signin-input"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        className="rb-signin-input"
        placeholder="Password"
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error ? <p className="rb-signin-error">{error}</p> : null}
      <button type="submit" className="rb-signin-email-btn" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in with email'}
      </button>
      <button
        type="button"
        className="rb-signin-link"
        onClick={() => {
          setMode(mode === 'register' ? 'signin' : 'register');
          setError('');
        }}
      >
        {mode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
      </button>
    </form>
  );
}

/** Login card — Google, Apple, and email (web + native). No logo. */
export default function SignInScreen({ clearSignedOut = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        <p className="rb-signin-subtitle">Sign in to access your memories</p>
        {showNativeTag ? (
          <p className="rb-signin-tag">Native bundle · v{BUILD_NUMBER}</p>
        ) : null}

        {error ? <p className="rb-signin-error">{error}</p> : null}

        <div className="rb-signin-actions">
          <OAuthButton
            id="restorebraine-google-btn"
            label="Continue with Google"
            className="rb-signin-google"
            onSignIn={signInWithGoogle}
            clearSignedOut={clearSignedOut}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
          />
          <OAuthButton
            id="restorebraine-apple-btn"
            label="Continue with Apple"
            className="rb-signin-apple"
            onSignIn={signInWithApple}
            clearSignedOut={clearSignedOut}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
          />
        </div>

        <p className="rb-signin-divider">or</p>
        <EmailSignIn clearSignedOut={clearSignedOut} />
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
