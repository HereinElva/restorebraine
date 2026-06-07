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
import { BASE44_APP_ID } from '@/lib/build-info';
import { RESTOREBRAINE_APP_URL } from '@/lib/app-params';

const SIGN_IN_URL = `https://app.base44.com/login?from_url=${encodeURIComponent(RESTOREBRAINE_APP_URL)}&app_id=${BASE44_APP_ID}&prompt=select_account`;

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin, manuallyLoggedOut } = useAuth();

  // Check if user manually logged out FIRST before anything else
  if (manuallyLoggedOut) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',padding:'24px'}}>
        <div style={{background:'white',borderRadius:'24px',padding:'40px',boxShadow:'0 10px 40px rgba(0,0,0,0.1)',maxWidth:'360px',width:'100%',textAlign:'center'}}>
          <div style={{width:'64px',height:'64px',background:'linear-gradient(135deg,#93c5fd,#a78bfa)',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <span style={{fontSize:'28px'}}>🔍</span>
          </div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>Restorebraine</h1>
          <p style={{color:'#666',marginBottom:'32px',fontSize:'14px'}}>Sign in to access your memories</p>
          <button onClick={() => { window.location.href = SIGN_IN_URL; }} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#60a5fa,#a78bfa)',color:'white',border:'none',borderRadius:'14px',fontSize:'16px',fontWeight:'600',cursor:'pointer'}}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (manuallyLoggedOut || authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',padding:'24px'}}>
          <div style={{background:'white',borderRadius:'24px',padding:'40px',boxShadow:'0 10px 40px rgba(0,0,0,0.1)',maxWidth:'360px',width:'100%',textAlign:'center'}}>
            <div style={{width:'64px',height:'64px',background:'linear-gradient(135deg,#93c5fd,#a78bfa)',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
              <span style={{fontSize:'28px'}}>🔍</span>
            </div>
            <h1 style={{fontSize:'24px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>Restorebraine</h1>
            <p style={{color:'#666',marginBottom:'32px',fontSize:'14px'}}>Sign in to access your memories</p>
            <button onClick={() => { localStorage.removeItem('b44_signed_out'); window.location.href = SIGN_IN_URL; }} style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#60a5fa,#a78bfa)',color:'white',border:'none',borderRadius:'14px',fontSize:'16px',fontWeight:'600',cursor:'pointer'}}>
              Sign In
            </button>
          </div>
        </div>
      );
    }
  }

  // Render the main app
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