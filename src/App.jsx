import './App.css'
import { useEffect, useRef } from 'react'
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
import { isNativeShell } from '@/lib/native-hosted-redirect';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

if (!isNativeShell()) {
  setupIframeMessaging();
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/** Web redirects to Base44 login; native v4-core shows simple sign-in → Google OAuth in browser. */
const SignInScreen = ({ onSignIn, clearSignedOut = false }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(20px, env(safe-area-inset-left))',
      paddingRight: 'max(20px, env(safe-area-inset-right))',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '36px 28px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        <LoginLogo />
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', margin: '0 0 28px' }}>Restorebraine</h1>
        <button
          type="button"
          onClick={() => {
            if (clearSignedOut) {
              try { localStorage.removeItem('b44_signed_out'); } catch {}
            }
            onSignIn();
          }}
          style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', color: 'white', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', touchAction: 'manipulation' }}
        >
          Continue with Google
        </button>
      </div>
    </div>
    <NativeDebugBadge />
  </div>
);

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

  if (isNativeShell()) {
    return <SignInScreen onSignIn={onSignIn} clearSignedOut={clearSignedOut} />;
  }

  return null;
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
