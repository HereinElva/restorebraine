import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'

import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { setupIframeMessaging } from './lib/iframe-messaging';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SignedOutLanding from '@/components/auth/SignedOutLanding';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

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
  const { isLoadingAuth, authError, isAuthenticated, navigateToLogin, manuallyLoggedOut } = useAuth();

  const handleSignIn = () => {
    try { localStorage.removeItem('b44_signed_out'); } catch {}
    navigateToLogin();
  };

  const signedOutView = (
    <LayoutWrapper currentPageName={mainPageKey}>
      <SignedOutLanding onSignIn={handleSignIn} />
    </LayoutWrapper>
  );

  if (manuallyLoggedOut) {
    return signedOutView;
  }

  if (isLoadingAuth) {
    return (
      <LayoutWrapper currentPageName={mainPageKey}>
        <div className="pt-24 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      </LayoutWrapper>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError?.type === 'auth_required') {
      return signedOutView;
    }
  }

  if (!isAuthenticated) {
    return signedOutView;
  }

  return (
    <LayoutWrapper currentPageName={mainPageKey}>
      <Routes>
        <Route path="/" element={<MainPage />} />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route key={path} path={`/${path.toLowerCase()}`} element={<Page />} />
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
