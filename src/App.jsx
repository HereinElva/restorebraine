import { useState } from 'react';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

setupIframeMessaging();

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const LoginLogo = () => (
  <div style={{width:'64px',height:'64px',borderRadius:'20px',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 8px 24px rgba(96,165,250,0.25)'}}>
    <img src="/AppIcon.png" alt="Restorebraine" style={{width:'100%',height:'100%',objectFit:'cover'}} />
  </div>
);

const LoginCard = () => {
  const { loginWithEmailPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await loginWithEmailPassword({ email: email.trim(), password });
    } catch (error) {
      setErrorMessage(error?.data?.message || error?.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',padding:'24px'}}>
      <form onSubmit={handleSubmit} style={{background:'white',borderRadius:'24px',padding:'36px',boxShadow:'0 10px 40px rgba(0,0,0,0.1)',maxWidth:'380px',width:'100%',textAlign:'center'}}>
        <LoginLogo />
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>Restorebraine</h1>
        <p style={{color:'#666',marginBottom:'28px',fontSize:'14px'}}>Sign in to access your memories</p>
        <label style={{display:'block',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#374151',marginBottom:'6px'}}>Email</label>
        <input
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d1d5db',borderRadius:'12px',fontSize:'16px',marginBottom:'14px'}}
        />
        <label style={{display:'block',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#374151',marginBottom:'6px'}}>Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d1d5db',borderRadius:'12px',fontSize:'16px',marginBottom:'18px'}}
        />
        {errorMessage ? <p style={{color:'#dc2626',fontSize:'13px',margin:'0 0 14px'}}>{errorMessage}</p> : null}
        <button disabled={isSubmitting} type="submit" style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#60a5fa,#a78bfa)',color:'white',border:'none',borderRadius:'14px',fontSize:'16px',fontWeight:'600',cursor:isSubmitting ? 'default' : 'pointer',opacity:isSubmitting ? 0.7 : 1}}>
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, manuallyLoggedOut } = useAuth();

  // Check if user manually logged out FIRST before anything else
  if (manuallyLoggedOut) {
    return <LoginCard />;
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
      return <LoginCard />;
    }
  }

  // Render the main app
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