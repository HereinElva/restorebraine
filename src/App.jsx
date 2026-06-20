import './App.css'
import { useState } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'

import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { setupIframeMessaging } from './lib/iframe-messaging';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import NativeDebugBadge from '@/components/NativeDebugBadge';
import LoginLogo from '@/components/LoginLogo';
import V4CoreWrongOrigin from '@/components/V4CoreWrongOrigin';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isV4CoreWrongOrigin } from '@/lib/v4-core-guard';
import { openLoginInSystemBrowser } from '@/lib/native-google-oauth';
import { getGoogleOAuthUrl } from '@/lib/auth-urls';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

if (!isNativeShell()) {
  setupIframeMessaging();
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const signInButtonStyle = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
  color: 'white',
  border: 'none',
  borderRadius: '14px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  touchAction: 'manipulation',
};

const SignInButton = ({ clearSignedOut = false }) => {
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
      if (isNativeShell()) {
        await openLoginInSystemBrowser(getGoogleOAuthUrl(), 'google');
      } else {
        window.location.href = getGoogleOAuthUrl();
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
        style={{
          ...signInButtonStyle,
          opacity: isOpening ? 0.75 : 1,
          cursor: isOpening ? 'wait' : 'pointer',
        }}
      >
        {isOpening ? 'Opening sign in…' : 'Continue with Google'}
      </button>
    </>
  );
};

const loginCardStyle = {
  background: 'white',
  borderRadius: '24px',
  padding: '36px 28px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  maxWidth: '360px',
  width: '100%',
  textAlign: 'center',
};

/** Same login card on web + native — logo, title, Continue with Google (no auto-redirect). */
const LoginGate = ({ clearSignedOut = false }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(20px, env(safe-area-inset-left))',
      paddingRight: 'max(20px, env(safe-area-inset-right))',
      boxSizing: 'border-box',
    }}
  >
    <div style={loginCardStyle}>
      <LoginLogo />
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 28px' }}>Restorebraine</h1>
      <SignInButton clearSignedOut={clearSignedOut} />
    </div>
    {isNativeShell() ? <NativeDebugBadge /> : null}
  </div>
);

const hasStoredSessionToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return false;
    return Boolean(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin, manuallyLoggedOut } = useAuth();

  if (manuallyLoggedOut) {
    return <LoginGate />;
  }

  const skipV4LoadingSpinner =
    LOCAL_NATIVE_BUNDLE && isNativeShell() && !hasStoredSessionToken();

  if ((isLoadingPublicSettings || isLoadingAuth) && !skipV4LoadingSpinner) {
    return (
      <>
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 gap-4">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading Restorebraine…</p>
          {isNativeShell() ? (
            <button
              type="button"
              onClick={navigateToLogin}
              className="mt-2 text-sm font-semibold text-purple-600 underline"
            >
              Sign in instead
            </button>
          ) : null}
        </div>
        <NativeDebugBadge />
      </>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authError || !isAuthenticated) {
    return <LoginGate clearSignedOut />;
  }

  return (
    <>
      <LayoutWrapper currentPageName={mainPageKey}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route key={path} path={`/${path.toLowerCase()}`} element={<Page />} />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </LayoutWrapper>
      <NativeDebugBadge />
    </>
  );
};


function App() {
  if (isV4CoreWrongOrigin()) {
    return <V4CoreWrongOrigin />;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
