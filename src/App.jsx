import './App.css'
import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'

function ClientCacheClearListener() {
  useEffect(() => {
    const onClearCaches = () => {
      queryClientInstance.clear();
    };
    window.addEventListener('restorebraine-clear-client-caches', onClearCaches);
    return () => window.removeEventListener('restorebraine-clear-client-caches', onClearCaches);
  }, []);
  return null;
}

import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { setupIframeMessaging } from './lib/iframe-messaging';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SignInScreen from '@/screens/SignInScreen';
import AiConsentGate from '@/components/auth/AiConsentGate';
import { hasStoredSessionToken } from '@/lib/session-bootstrap';
import { isNativeShell } from '@/lib/native-hosted-redirect';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

if (!isNativeShell()) {
  setupIframeMessaging();
}

/** BrowserRouter breaks on capacitor:// — use HashRouter for bundled native builds. */
const NativeRouter = (() => {
  try {
    if (typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== 'undefined' && __RESTOREBRAINE_NATIVE_LOCAL__) {
      return HashRouter;
    }
    if (typeof window !== 'undefined') {
      const p = window.location?.protocol;
      if (p === 'capacitor:' || p === 'ionic:') return HashRouter;
    }
  } catch {}
  return BrowserRouter;
})();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { authError, isAuthenticated, manuallyLoggedOut } = useAuth();
  const hasToken = hasStoredSessionToken();

  if (manuallyLoggedOut && !hasToken) {
    return <SignInScreen clearSignedOut />;
  }

  if (!hasToken && !isAuthenticated) {
    return <SignInScreen />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated && !hasToken) {
    return <SignInScreen clearSignedOut={manuallyLoggedOut} />;
  }

  // Token present — render gallery immediately; auth/settings finish in background (Omega 3).
  return (
    <AiConsentGate>
      <LayoutWrapper currentPageName={mainPageKey}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route key={path} path={`/${path.toLowerCase()}`} element={<Page />} />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </LayoutWrapper>
    </AiConsentGate>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ClientCacheClearListener />
        <NativeRouter>
          <NavigationTracker />
          <AuthenticatedApp />
        </NativeRouter>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
