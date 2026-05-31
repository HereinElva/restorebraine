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
import { RESTOREBRAINE_APP_LOGO } from '@/lib/app-branding';
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

const SignInButton = ({ onSignIn }) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = () => {
    if (isOpening) return;
    setIsOpening(true);
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
      data-rb-sign-in="1"
      onClick={handleClick}
      disabled={isOpening}
      style={{
        ...signInButtonStyle,
        opacity: isOpening ? 0.75 : 1,
        cursor: isOpening ? 'wait' : 'pointer',
      }}
    >
      {isOpening ? 'Opening sign in…' : 'Sign In'}
    </button>
  );
};

const SignInScreen = ({ onSignIn }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)', padding: '24px' }}>
    <div style={{ background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
      <img
        src={RESTOREBRAINE_APP_LOGO}
        alt="Restorebraine"
        style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', margin: '0 auto 16px', display: 'block' }}
      />
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', marginBottom: '8px' }}>Restorebraine</h1>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>Sign in to access your memories</p>
      <SignInButton onSignIn={onSignIn} />
    </div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, manuallyLoggedOut } = useAuth();

  if (manuallyLoggedOut) {
    return <SignInScreen onSignIn={navigateToLogin} />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (manuallyLoggedOut || authError) {
    if (authError?.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError?.type === 'auth_required') {
      return <SignInScreen onSignIn={navigateToLogin} />;
    }
  }

  return (
    <LayoutWrapper currentPageName={mainPageKey}>
      <Routes>
        <Route path="/" element={<MainPage />} />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={<Page />} />
        ))}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </LayoutWrapper>
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
