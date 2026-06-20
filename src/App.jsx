import './App.css'
import { useEffect, useRef, useState } from 'react'
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
import { NATIVE_BUILD_LABEL } from '@/lib/build-info';
import { getRestorebraineAppLogo } from '@/lib/app-branding';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const RESTOREBRAINE_APP_LOGO = getRestorebraineAppLogo();

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
};

const SignInButton = ({ onSignIn, clearSignedOut = false }) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = () => {
    if (isOpening) return;
    setIsOpening(true);
    if (clearSignedOut) {
      try { localStorage.removeItem('b44_signed_out'); } catch {}
    }
    try {
      onSignIn();
    } catch (error) {
      console.error('Sign-in failed to open', error);
      setIsOpening(false);
    }
  };

  return (
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
      {isOpening ? 'Opening sign in…' : (LOCAL_NATIVE_BUNDLE ? 'Continue with Google' : 'Sign In')}
    </button>
  );
};

/** Web redirects immediately; native uses build-v4 bundled shell with manual Sign In (no auto-open). */
const LoginGate = ({ onSignIn, clearSignedOut = false }) => {
  const started = useRef(false);

  useEffect(() => {
    if (isNativeShell()) return;
    if (started.current) return;
    started.current = true;
    if (clearSignedOut) {
      try { localStorage.removeItem('b44_signed_out'); } catch {}
    }
    onSignIn();
  }, [onSignIn, clearSignedOut]);

  if (!isNativeShell()) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 gap-4">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading sign in…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        <img
          src={RESTOREBRAINE_APP_LOGO}
          alt="Restorebraine"
          data-rb-logo="1"
          style={{ width: '64px', height: '64px', borderRadius: '20px', objectFit: 'cover', display: 'block', margin: '0 auto 20px' }}
        />
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', marginBottom: '8px' }}>Restorebraine</h1>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
          Sign in to access your memories
        </p>
        <SignInButton onSignIn={onSignIn} clearSignedOut={clearSignedOut} />
        <p style={{ margin: '14px 0 0', color: '#c4b5fd', fontSize: '11px', fontWeight: '600' }}>{NATIVE_BUILD_LABEL}</p>
      </div>
      <NativeDebugBadge />
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin, manuallyLoggedOut } = useAuth();

  if (manuallyLoggedOut) {
    return <LoginGate onSignIn={navigateToLogin} />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
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
    return <LoginGate onSignIn={navigateToLogin} clearSignedOut />;
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
