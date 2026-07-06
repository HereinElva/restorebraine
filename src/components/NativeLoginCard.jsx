import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { launchProviderOAuth } from '@/lib/native-google-oauth';
import { BUILD_NUMBER } from '@/lib/build-info';
import '@/screens/sign-in.css';

const BRAND_GRADIENT = 'linear-gradient(135deg,#60a5fa,#a78bfa)';

const APPLE_BUTTON_STYLE = {
  width: '100%',
  minHeight: '44px',
  padding: '0 16px',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  background: '#000000',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'rgba(255,255,255,0.1)',
  touchAction: 'manipulation',
  boxSizing: 'border-box',
};

/** Inline Apple logo — self-contained for Base44 publish (no separate file import). */
function AppleLogoMark({ size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      data-rb-apple-logo="1"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0 }}
    >
      <path
        fill="#ffffff"
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}

/** Sign in with Apple — HIG black button + logo (App Store Review 4.8). */
function AppleSignInButton({ onClick, loading = false }) {
  const text = loading ? 'Opening Apple…' : 'Sign in with Apple';
  return (
    <button
      type="button"
      data-rb-provider="apple"
      data-rb-apple-sign-in="true"
      className="rb-signin-apple"
      onClick={onClick}
      disabled={loading}
      aria-label={text}
      style={{
        ...APPLE_BUTTON_STYLE,
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'wait' : 'pointer',
      }}
    >
      <AppleLogoMark size={20} />
      <span style={{ color: '#ffffff', lineHeight: 1.2 }}>{text}</span>
    </button>
  );
}

const cardStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
  padding: '20px',
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
    }}
  >
    {children}
  </button>
);

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

  const handleProviderClick = (provider) => {
    if (openingProvider) return;
    clearSignedOutFlag();
    setErrorMessage('');
    setOpeningProvider(provider);
    window.setTimeout(() => setOpeningProvider(null), 900);
    launchProviderOAuth(provider);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');
    clearSignedOutFlag();

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password to sign in.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('Enter your name to create an account.');
      return;
    }

    setNoticeMessage(mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerWithEmailPassword({ fullName: fullName.trim(), email: email.trim(), password });
        setNoticeMessage('Account created.');
        setMode('signin');
      } else {
        await loginWithEmailPassword({ email: email.trim(), password });
        setNoticeMessage('Signed in.');
      }
    } catch (error) {
      setNoticeMessage('');
      setErrorMessage(
        error?.data?.message || error?.message || (mode === 'signup' ? 'Unable to create account' : 'Invalid email or password'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={cardStyle} data-rb-auth="sign-in-v4">
      <div style={formStyle}>
        <p
          data-rb-login-build={BUILD_NUMBER}
          style={{
            margin: '0 0 18px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#7c3aed',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Login v{BUILD_NUMBER}
        </p>
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

        <ProviderButton provider="google" onClick={() => handleProviderClick('google')} disabled={openingProvider === 'google'}>
          <span style={{ color: '#4285F4', fontWeight: '800', marginRight: '10px' }}>G</span>
          {openingProvider === 'google' ? 'Opening Google…' : 'Continue With Google'}
        </ProviderButton>
        <AppleSignInButton
          onClick={() => handleProviderClick('apple')}
          loading={openingProvider === 'apple'}
        />
        <ProviderButton provider="microsoft" onClick={() => handleProviderClick('microsoft')} disabled={openingProvider === 'microsoft'}>
          <span style={{ color: '#0078d4', fontWeight: '800', marginRight: '10px' }}>M</span>
          {openingProvider === 'microsoft' ? 'Opening Microsoft…' : 'Continue With Microsoft'}
        </ProviderButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '18px 0', color: '#9ca3af', fontSize: '13px' }}>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
          <span>OR</span>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
        </div>

        <form onSubmit={handleSubmit} noValidate>
        {mode === 'signup' ? (
          <>
            <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Name</label>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: '12px', fontSize: '16px', marginBottom: '12px' }}
            />
          </>
        ) : null}
        <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
        <input
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #d1d5db', borderRadius: '12px', fontSize: '16px', marginBottom: '12px' }}
        />
        <label style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Password</label>
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setErrorMessage('');
            setNoticeMessage('');
          }}
          style={{ marginTop: '16px', background: 'transparent', border: 'none', color: '#7c3aed', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
        <p
          data-rb-login-build={BUILD_NUMBER}
          style={{ margin: '14px 0 0', fontSize: '11px', color: '#9ca3af', letterSpacing: '0.02em' }}
        >
          Build v{BUILD_NUMBER}
        </p>
        </form>
      </div>
    </div>
  );
}
