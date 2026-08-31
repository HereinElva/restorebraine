import './App.css'
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
import SignInScreen, { hasStoredSessionToken } from '@/screens/SignInScreen';
import V4CoreWrongOrigin from '@/components/V4CoreWrongOrigin';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { isV4CoreWrongOrigin } from '@/lib/v4-core-guard';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

if (!isNativeShell()) {
  setupIframeMessaging();
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { authError, isAuthenticated, manuallyLoggedOut } = useAuth();

  if (manuallyLoggedOut) {
    return <SignInScreen clearSignedOut />;
  }

  const hasToken = hasStoredSessionToken();

  if (!hasToken && !isAuthenticated) {
    return <SignInScreen />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated && !hasToken) {
    return <SignInScreen clearSignedOut={manuallyLoggedOut} />;
  }

  // Token or session present — render app immediately; auth/settings finish in background.
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
