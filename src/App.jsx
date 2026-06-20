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
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

if (!isNativeShell()) {
  setupIframeMessaging();
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/** v4-core: auto-open real Base44 login in InAppBrowser — no custom sign-in UI. */
const NativeLoginOpening = ({ onRetry, errorMessage = '' }) => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 gap-4 px-6">
    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    <p className="text-sm text-gray-500 text-center">Opening sign in…</p>
    {errorMessage ? <p className="text-sm text-red-600 text-center max-w-xs">{errorMessage}</p> : null}
    <button
      type="button"
      onClick={onRetry}
      className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-400 to-purple-500"
    >
      Try again
    </button>
    <NativeDebugBadge />
  </div>
);

const LoginGate = ({ onSignIn, clearSignedOut = false }) => {
  const started = useRef(false);
  const [openError, setOpenError] = useState('');

  const startLogin = () => {
    if (clearSignedOut) {
      try { localStorage.removeItem('b44_signed_out'); } catch {}
    }
    setOpenError('');
    Promise.resolve(onSignIn()).catch((error) => {
      console.error('Login open failed', error);
      setOpenError(error?.message || 'Could not open sign in. Tap Try again.');
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startLogin();
  }, []);

  if (LOCAL_NATIVE_BUNDLE && isNativeShell()) {
    return <NativeLoginOpening onRetry={startLogin} errorMessage={openError} />;
  }

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
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', marginBottom: '32px' }}>Restorebraine</h1>
        <button
          type="button"
          onClick={startLogin}
          style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', color: 'white', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
        >
          Sign in
        </button>
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
