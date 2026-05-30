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
import { NATIVE_BUILD_LABEL } from '@/lib/build-info';

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

const ProviderButton = ({ children, onClick, dark = false }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width:'100%',
      padding:'13px 14px',
      background: dark ? '#000' : '#fff',
      color: dark ? '#fff' : '#374151',
      border: dark ? '1px solid #000' : '1px solid #d1d5db',
      borderRadius:'10px',
      fontSize:'15px',
      fontWeight:'600',
      cursor:'pointer',
      marginBottom:'10px',
      boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
    }}
  >
    {children}
  </button>
);

const LoginCard = () => {
  const { loginWithEmailPassword, registerWithEmailPassword } = useAuth();
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleProviderClick = (provider) => {
    const message = `${provider} sign-in will be enabled after native ${provider} credentials are configured. Please use email sign-in for this build.`;
    setErrorMessage('');
    setNoticeMessage(message);
    window.alert(message);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password to sign in.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('Enter your name to create an account.');
      return;
    }

    setNoticeMessage(mode === 'signup' ? 'Creating your account...' : 'Signing in...');
    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        await registerWithEmailPassword({ fullName: fullName.trim(), email: email.trim(), password });
        setNoticeMessage('Account created. If you are not signed in automatically, sign in with your email and password.');
        setMode('signin');
      } else {
        await loginWithEmailPassword({ email: email.trim(), password });
        setNoticeMessage('Signed in. Loading your memories...');
      }
    } catch (error) {
      setNoticeMessage('');
      const message = error?.data?.message || error?.message || (mode === 'signup' ? 'Unable to create account' : 'Invalid email or password');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',padding:'20px'}}>
      <form onSubmit={handleSubmit} noValidate style={{background:'white',borderRadius:'24px',padding:'30px',boxShadow:'0 10px 40px rgba(0,0,0,0.1)',maxWidth:'390px',width:'100%',textAlign:'center'}}>
        <LoginLogo />
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>Restorebraine</h1>
        <p style={{color:'#666',marginBottom:'24px',fontSize:'14px'}}>Sign in to access your memories</p>

        <ProviderButton onClick={() => handleProviderClick('Google')}><span style={{color:'#4285F4',fontWeight:'800',marginRight:'10px'}}>G</span>Continue With Google</ProviderButton>
        <ProviderButton onClick={() => handleProviderClick('Apple')} dark>Continue With Apple</ProviderButton>
        <p style={{color:'#6b7280',fontSize:'12px',lineHeight:1.4,margin:'0 0 12px'}}>Google and Apple sign-in require native developer credentials. Tap either option for details, or use email sign-in now.</p>

        <div style={{display:'flex',alignItems:'center',gap:'14px',margin:'18px 0',color:'#9ca3af',fontSize:'13px'}}>
          <div style={{height:'1px',background:'#e5e7eb',flex:1}} />
          <span>OR</span>
          <div style={{height:'1px',background:'#e5e7eb',flex:1}} />
        </div>

        {mode === 'signup' ? (
          <>
            <label style={{display:'block',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#374151',marginBottom:'6px'}}>Name</label>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              style={{width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d1d5db',borderRadius:'12px',fontSize:'16px',marginBottom:'12px'}}
            />
          </>
        ) : null}
        <label style={{display:'block',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#374151',marginBottom:'6px'}}>Email</label>
        <input
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d1d5db',borderRadius:'12px',fontSize:'16px',marginBottom:'12px'}}
        />
        <label style={{display:'block',textAlign:'left',fontSize:'13px',fontWeight:'600',color:'#374151',marginBottom:'6px'}}>Password</label>
        <input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{width:'100%',boxSizing:'border-box',padding:'13px 14px',border:'1px solid #d1d5db',borderRadius:'12px',fontSize:'16px',marginBottom:'16px'}}
        />
        {errorMessage ? <p style={{color:'#dc2626',fontSize:'13px',margin:'0 0 12px'}}>{errorMessage}</p> : null}
        {noticeMessage ? <p style={{color:'#6b7280',fontSize:'13px',margin:'0 0 12px'}}>{noticeMessage}</p> : null}
        <button disabled={isSubmitting} type="submit" style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#60a5fa,#a78bfa)',color:'white',border:'none',borderRadius:'14px',fontSize:'16px',fontWeight:'600',cursor:isSubmitting ? 'default' : 'pointer',opacity:isSubmitting ? 0.7 : 1}}>
          {isSubmitting ? (mode === 'signup' ? 'Creating Account...' : 'Signing In...') : (mode === 'signup' ? 'Create Account' : 'Sign In With Email')}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErrorMessage(''); setNoticeMessage(''); }}
          style={{marginTop:'16px',background:'transparent',border:'none',color:'#7c3aed',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
        <p style={{margin:'14px 0 0',color:'#c4b5fd',fontSize:'11px',fontWeight:'600'}}>{NATIVE_BUILD_LABEL}</p>
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