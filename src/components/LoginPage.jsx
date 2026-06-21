import { useState } from 'react';
import LoginLogo from '@/components/LoginLogo';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import { getGoogleOAuthUrl } from '@/lib/auth-urls';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';

const PAGE_BG = 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)';
const BTN_GRADIENT = 'linear-gradient(135deg,#60a5fa,#a78bfa)';

const cardStyle = {
  background: '#fff',
  borderRadius: '24px',
  padding: '36px 28px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  maxWidth: '360px',
  width: '100%',
  textAlign: 'center',
};

function GoogleSignInButton({ clearSignedOut = false }) {
  const [isOpening, setIsOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleClick = async () => {
    if (isOpening) return;
    setErrorMessage('');
    setIsOpening(true);
    if (clearSignedOut) {
      try { localStorage.removeItem('b44_signed_out'); } catch {}
    }
    try {
      const oauthUrl = getGoogleOAuthUrl();
      if (isNativeShell()) {
        await openLoginInSystemBrowser(oauthUrl, 'google');
      } else {
        window.location.href = oauthUrl;
      }
      setIsOpening(false);
    } catch (error) {
      console.error('Sign-in failed to open', error);
      setErrorMessage(error?.message || 'Could not open sign in. Try again.');
      setIsOpening(false);
    }
  };

  return (
    <>
      {errorMessage ? (
        <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px', lineHeight: 1.4 }}>{errorMessage}</p>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isOpening}
        id="rb-login-google-btn"
        style={{
          width: '100%',
          padding: '14px',
          background: BTN_GRADIENT,
          color: '#fff',
          border: 'none',
          borderRadius: '14px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: isOpening ? 'wait' : 'pointer',
          opacity: isOpening ? 0.75 : 1,
          touchAction: 'manipulation',
        }}
      >
        {isOpening ? 'Opening sign in…' : 'Continue with Google'}
      </button>
    </>
  );
}

/** Restorebraine login — white card, brain logo, Continue with Google. Web + native identical. */
export default function LoginPage({ clearSignedOut = false }) {
  return (
    <div
      id="rb-login-page"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PAGE_BG,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={cardStyle}>
        <LoginLogo />
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 28px' }}>
          Restorebraine
        </h1>
        <GoogleSignInButton clearSignedOut={clearSignedOut} />
      </div>
      {isNativeShell() ? <NativeDebugBadge /> : null}
    </div>
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
