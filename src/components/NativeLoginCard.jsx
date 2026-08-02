import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { launchProviderOAuth } from '@/lib/native-google-oauth';
import { normalizeAuthEmail } from '@/lib/session-bootstrap';
import { AppleLogo, GoogleMark, MicrosoftMark } from '@/components/auth/ProviderLogos';

const BRAND_GRADIENT = 'linear-gradient(135deg,#60a5fa,#a78bfa)';

const cardStyle = {
  position: 'fixed',
  inset: 0,
  height: '100dvh',
  maxHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  overflow: 'hidden',
  overscrollBehavior: 'none',
  background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
  padding: 'max(16px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))',
};

const formStyle = {
  background: 'white',
  borderRadius: '24px',
  padding: '30px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  maxWidth: '390px',
  width: '100%',
  textAlign: 'center',
};

const ProviderButton = ({ children, onClick, provider, dark = false, disabled = false }) => (
  <button
    type="button"
    data-rb-provider={provider}
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '100%',
      padding: '13px 14px',
      background: dark ? '#000' : '#fff',
      color: dark ? '#fff' : '#374151',
      border: dark ? '1px solid #000' : '1px solid #d1d5db',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: disabled ? 'wait' : 'pointer',
      marginBottom: '10px',
      boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
      opacity: disabled ? 0.7 : 1,
      WebkitTapHighlightColor: 'rgba(0,0,0,0.08)',
      touchAction: 'manipulation',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    }}
  >
    {children}
  </button>
);

function formatAuthError(error, mode) {
  const raw = error?.data?.message || error?.message || (mode === 'signup' ? 'Unable to create account' : 'Invalid email or password');
  if (mode === 'signup' && /already exists/i.test(raw)) {
    return 'That email may already be registered. If you used Apple or Google before, tap that button instead. Otherwise try signing in with the same password.';
  }
  if (mode === 'signin' && /invalid|password|credentials|401/i.test(raw)) {
    return 'Invalid email or password. If you signed up with Apple or Google, use that button instead of email.';
  }
  return raw;
}

/** v4 bundled native login — all providers + email. No logo. */
export default function NativeLoginCard({ clearSignedOut = false }) {
  const { loginWithEmailPassword, registerWithEmailPassword } = useAuth();
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingProvider, setOpeningProvider] = useState(null);

  useEffect(() => {
    if (clearSignedOut) {
      setFullName('');
      setEmail('');
      setPassword('');
      setErrorMessage('');
      setNoticeMessage('');
      setMode('signin');
    }
  }, [clearSignedOut]);

  useEffect(() => {
    const resetOpening = () => setOpeningProvider(null);
    const onSessionUpdated = () => resetOpening();
    window.addEventListener('restorebraine-native-oauth-complete', resetOpening);
    window.addEventListener('restorebraine-session-updated', onSessionUpdated);
    return () => {
      window.removeEventListener('restorebraine-native-oauth-complete', resetOpening);
      window.removeEventListener('restorebraine-session-updated', onSessionUpdated);
    };
  }, []);

  const clearSignedOutFlag = () => {
    try {
      localStorage.removeItem('b44_signed_out');
      localStorage.removeItem('base44_logged_out');
    } catch {
      /* ignore */
    }
  };

  const handleProviderClick = (provider, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (isSubmitting || openingProvider) return;
    clearSignedOutFlag();
    setErrorMessage('');
    setOpeningProvider(provider);
    window.setTimeout(() => setOpeningProvider(null), 12000);

    try {
      window.__restorebraineLastOAuthProvider = provider;
    } catch {
      /* ignore */
    }

    if (typeof window.__restorebraineOpenProviderLogin === 'function') {
      window.__restorebraineOpenProviderLogin(provider);
      return;
    }
    launchProviderOAuth(provider);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');

    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail || !password) {
      setErrorMessage('Enter your email and password to continue.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('Enter your name to create an account.');
      return;
    }

    setNoticeMessage(mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    setIsSubmitting(true);
    const submitGuard = window.setTimeout(() => {
      setIsSubmitting(false);
      setNoticeMessage('');
      setErrorMessage(
        mode === 'signup'
          ? 'Registration is taking too long. Check your connection and try again, or sign in if the account was already created.'
          : 'Sign in is taking too long. Check your connection and try again.',
      );
    }, 25000);
    try {
      if (mode === 'signup') {
        await registerWithEmailPassword({
          fullName: fullName.trim(),
          email: normalizedEmail,
          password,
        });
        setNoticeMessage('Welcome! You are signed in.');
        setFullName('');
        setEmail('');
        setPassword('');
      } else {
        clearSignedOutFlag();
        await loginWithEmailPassword({ email: normalizedEmail, password });
        setNoticeMessage('Signed in.');
      }
    } catch (error) {
      setNoticeMessage('');
      const message = formatAuthError(error, mode);
      setErrorMessage(message);
      if (mode === 'signup' && /already exists|already have an account/i.test(message)) {
        setMode('signin');
      }
    } finally {
      window.clearTimeout(submitGuard);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={cardStyle} data-rb-auth="sign-in-v4">
      <div style={formStyle}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: '700',
            margin: '0 0 24px',
            background: BRAND_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Restorebraine
        </h1>

        <ProviderButton provider="google" onClick={(event) => handleProviderClick('google', event)} disabled={isSubmitting || openingProvider === 'google'}>
          <GoogleMark />
          {openingProvider === 'google' ? 'Opening Google…' : 'Continue With Google'}
        </ProviderButton>
        <ProviderButton provider="apple" dark onClick={(event) => handleProviderClick('apple', event)} disabled={isSubmitting || openingProvider === 'apple'}>
          <AppleLogo />
          {openingProvider === 'apple' ? 'Opening Apple…' : 'Continue With Apple'}
        </ProviderButton>
        <ProviderButton provider="microsoft" onClick={(event) => handleProviderClick('microsoft', event)} disabled={isSubmitting || openingProvider === 'microsoft'}>
          <MicrosoftMark />
          {openingProvider === 'microsoft' ? 'Opening Microsoft…' : 'Continue With Microsoft'}
        </ProviderButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '18px 0', color: '#9ca3af', fontSize: '13px' }}>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
          <span>OR</span>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
        </div>

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
        {mode === 'signup' ? (
          <>
            <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Name</label>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: '12px', fontSize: '16px', marginBottom: '12px' }}
            />
          </>
        ) : null}
        <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
        <input
          type="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete={mode === 'signup' ? 'email' : 'username'}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errorMessage) setErrorMessage('');
          }}
          required
          style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: '12px', fontSize: '16px', marginBottom: '12px' }}
        />
        <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Password</label>
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errorMessage) setErrorMessage('');
          }}
          required
          style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: '12px', fontSize: '16px', marginBottom: '16px' }}
        />
        {errorMessage ? <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px' }}>{errorMessage}</p> : null}
        {noticeMessage ? <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px' }}>{noticeMessage}</p> : null}
        <button
          disabled={isSubmitting}
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            background: BRAND_GRADIENT,
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isSubmitting ? 'default' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? (mode === 'signup' ? 'Creating Account…' : 'Signing In…') : (mode === 'signup' ? 'Create Account' : 'Sign In With Email')}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            if (isSubmitting) return;
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setErrorMessage('');
            setNoticeMessage('');
          }}
          style={{ marginTop: '16px', background: 'transparent', border: 'none', color: '#7c3aed', fontSize: '14px', fontWeight: '600', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
        </form>
      </div>
    </div>
  );
}
