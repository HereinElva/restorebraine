import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { NATIVE_BUILD_LABEL, WEB_BUILD_LABEL } from '@/lib/build-info';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';
import { getGoogleOAuthUrl, getProviderOAuthUrl } from '@/lib/native-platform-guard';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import NativeDebugBadge from '@/components/NativeDebugBadge';

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

const ProviderButton = ({ children, onClick, dark = false, disabled = false }) => (
  <button
    type="button"
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

  const clearSignedOutFlag = () => {
    try {
      localStorage.removeItem('b44_signed_out');
      localStorage.removeItem('base44_logged_out');
    } catch {
      /* ignore */
    }
  };

  const handleProviderClick = async (provider) => {
    if (openingProvider) return;
    clearSignedOutFlag();
    setErrorMessage('');
    setNoticeMessage('');
    setOpeningProvider(provider);
    try {
      const url = provider === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(provider);
      await openLoginInSystemBrowser(url, provider);
    } catch (error) {
      console.error(`${provider} sign-in failed to open`, error);
      setErrorMessage('Could not open sign in. Try again or use email.');
    } finally {
      setOpeningProvider(null);
    }
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
      <form onSubmit={handleSubmit} noValidate style={formStyle}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 24px' }}>Restorebraine</h1>

        <ProviderButton onClick={() => handleProviderClick('google')} disabled={!!openingProvider}>
          <span style={{ color: '#4285F4', fontWeight: '800', marginRight: '10px' }}>G</span>
          {openingProvider === 'google' ? 'Opening Google…' : 'Continue With Google'}
        </ProviderButton>
        <ProviderButton dark onClick={() => handleProviderClick('apple')} disabled={!!openingProvider}>
          {openingProvider === 'apple' ? 'Opening Apple…' : 'Continue With Apple'}
        </ProviderButton>
        <ProviderButton onClick={() => handleProviderClick('microsoft')} disabled={!!openingProvider}>
          <span style={{ color: '#0078d4', fontWeight: '800', marginRight: '10px' }}>M</span>
          {openingProvider === 'microsoft' ? 'Opening Microsoft…' : 'Continue With Microsoft'}
        </ProviderButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '18px 0', color: '#9ca3af', fontSize: '13px' }}>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
          <span>OR</span>
          <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
        </div>

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
          disabled={isSubmitting || !!openingProvider}
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
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
        <p style={{ margin: '14px 0 0', color: '#c4b5fd', fontSize: '11px', fontWeight: '600' }}>
          {isNativeShell() ? NATIVE_BUILD_LABEL : WEB_BUILD_LABEL}
        </p>
      </form>
      <NativeDebugBadge />
    </div>
  );
}
