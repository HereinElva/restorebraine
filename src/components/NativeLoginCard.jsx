import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import LoginLogo from '@/components/LoginLogo';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';
import { getGoogleOAuthUrl, getProviderOAuthUrl } from '@/lib/native-platform-guard';
import NativeDebugBadge from '@/components/NativeDebugBadge';

const shellStyle = {
  height: '100dvh',
  maxHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
  paddingTop: 'max(8px, env(safe-area-inset-top))',
  paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
  paddingLeft: 'max(12px, env(safe-area-inset-left))',
  paddingRight: 'max(12px, env(safe-area-inset-right))',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

const scrollStyle = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '4px 0 12px',
};

const formStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '18px 16px 16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  maxWidth: '340px',
  width: '100%',
  textAlign: 'center',
  margin: 'auto',
  boxSizing: 'border-box',
};

const ProviderButton = ({ children, onClick, dark = false, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '100%',
      padding: '11px 12px',
      background: dark ? '#000' : '#fff',
      color: dark ? '#fff' : '#374151',
      border: dark ? '1px solid #000' : '1px solid #d1d5db',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: disabled ? 'wait' : 'pointer',
      marginBottom: '8px',
      boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      opacity: disabled ? 0.7 : 1,
      touchAction: 'manipulation',
    }}
  >
    {children}
  </button>
);

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  fontSize: '16px',
  marginBottom: '10px',
};

/** Build v4-style login — compact layout for iPhone; OAuth opens in-app browser when tapped. */
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
    if (!clearSignedOut) return;
    try { localStorage.removeItem('b44_signed_out'); } catch {}
  };

  const handleProviderClick = async (provider) => {
    if (openingProvider || isSubmitting) return;
    clearSignedOutFlag();
    setErrorMessage('');
    setNoticeMessage('');
    setOpeningProvider(provider);
    try {
      const url = provider === 'google' ? getGoogleOAuthUrl() : getProviderOAuthUrl(provider);
      await openLoginInSystemBrowser(url, provider);
    } catch (error) {
      console.error(`${provider} sign-in failed to open`, error);
      setErrorMessage(error?.message || 'Could not open sign in. Try again or use email.');
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
        setNoticeMessage('Account created. Loading your memories…');
        setMode('signin');
      } else {
        await loginWithEmailPassword({ email: email.trim(), password });
        setNoticeMessage('Signed in. Loading your memories…');
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
    <div style={shellStyle}>
      <div style={scrollStyle}>
        <form onSubmit={handleSubmit} noValidate style={formStyle}>
          <LoginLogo />
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111', margin: '0 0 4px' }}>Restorebraine</h1>
          <p style={{ color: '#666', marginBottom: '16px', fontSize: '13px', lineHeight: 1.35 }}>Sign in to access your memories</p>

          <ProviderButton onClick={() => handleProviderClick('google')} disabled={!!openingProvider || isSubmitting}>
            <span style={{ color: '#4285F4', fontWeight: '800', marginRight: '8px' }}>G</span>
            {openingProvider === 'google' ? 'Opening Google…' : 'Continue With Google'}
          </ProviderButton>
          <ProviderButton dark onClick={() => handleProviderClick('apple')} disabled={!!openingProvider || isSubmitting}>
            {openingProvider === 'apple' ? 'Opening Apple…' : 'Continue With Apple'}
          </ProviderButton>
          <ProviderButton onClick={() => handleProviderClick('microsoft')} disabled={!!openingProvider || isSubmitting}>
            <span style={{ color: '#0078d4', fontWeight: '800', marginRight: '8px' }}>M</span>
            {openingProvider === 'microsoft' ? 'Opening Microsoft…' : 'Continue With Microsoft'}
          </ProviderButton>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', color: '#9ca3af', fontSize: '12px' }}>
            <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
            <span>OR</span>
            <div style={{ height: '1px', background: '#e5e7eb', flex: 1 }} />
          </div>

          {mode === 'signup' ? (
            <>
              <label style={{ display: 'block', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Name</label>
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                style={fieldStyle}
              />
            </>
          ) : null}
          <label style={{ display: 'block', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Email</label>
          <input
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={fieldStyle}
          />
          <label style={{ display: 'block', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Password</label>
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ ...fieldStyle, marginBottom: '12px' }}
          />
          {errorMessage ? <p style={{ color: '#dc2626', fontSize: '12px', margin: '0 0 10px', lineHeight: 1.35 }}>{errorMessage}</p> : null}
          {noticeMessage ? <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 10px', lineHeight: 1.35 }}>{noticeMessage}</p> : null}
          <button
            disabled={isSubmitting || !!openingProvider}
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: isSubmitting ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              touchAction: 'manipulation',
            }}
          >
            {isSubmitting ? (mode === 'signup' ? 'Creating Account…' : 'Signing In…') : (mode === 'signup' ? 'Create Account' : 'Sign In With Email')}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErrorMessage(''); setNoticeMessage(''); }}
            style={{ marginTop: '12px', background: 'transparent', border: 'none', color: '#7c3aed', fontSize: '13px', fontWeight: '600', cursor: 'pointer', touchAction: 'manipulation' }}
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
      <NativeDebugBadge />
    </div>
  );
}
