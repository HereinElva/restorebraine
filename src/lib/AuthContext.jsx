import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { clearPersistedToken } from '@/lib/app-params';
import { appParams } from '@/lib/app-params';
import { persistentStorage } from '@/lib/persistentStorage';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const EMAIL_VERIFICATION_REQUIRED = 'email_verification_required';

const getAuthErrorMessage = (error) => error?.data?.message || error?.message || 'Something went wrong';

const isVerificationRequiredMessage = (message) => /verify your email|verification code/i.test(message || '');

const createVerificationError = (message, email) => {
  const error = new Error(message);
  error.code = EMAIL_VERIFICATION_REQUIRED;
  error.email = email;
  return error;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [manuallyLoggedOut, setManuallyLoggedOut] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    if (localStorage.getItem("b44_signed_out") === "1") { setIsLoadingPublicSettings(false); setIsLoadingAuth(false); setAuthError({ type: "auth_required", message: "Authentication required" }); return; }
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token,
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          await clearPersistedToken();
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
        } else if (appError.status === 403) {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
        } else if (appError.status === 404) {
          setAuthError({ type: 'auth_required', message: 'App not found. Rebuild with the latest native build from Xcode.' });
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
        } else {
          setIsLoadingPublicSettings(false);
          if (appParams.token) {
            await checkUserAuth();
          } else {
            setIsLoadingAuth(false);
          }
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const persistAccessToken = async (token) => {
    if (!token) return;
    appParams.token = token;
    base44.auth.setToken(token);
    await persistentStorage.set('base44_access_token', token);
    await persistentStorage.set('token', token);
  };

  const completeAuthSession = async (accessToken, authUser) => {
    localStorage.removeItem('b44_signed_out');
    localStorage.removeItem('base44_logged_out');
    await persistAccessToken(accessToken);
    setManuallyLoggedOut(false);
    setUser(authUser ?? null);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    setAuthError(null);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    if (manuallyLoggedOut) return;
    if (localStorage.getItem("b44_signed_out") === "1") { setIsLoadingAuth(false); setIsAuthenticated(false); setAuthError({ type: "auth_required", message: "Authentication required" }); return; }
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      if (!currentUser?.email) {
        await clearPersistedToken();
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Please sign in with your Restorebraine email.' });
        setIsLoadingAuth(false);
        return;
      }
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      await clearPersistedToken();
      
      if (error.status === 401) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } else if (error.status === 403) {
        setAuthError({
          type: 'user_not_registered',
          message: 'User not registered for this app'
        });
      }
    }
  };

  const localLogout = async () => {
    setManuallyLoggedOut(true);
    try {
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
      sessionStorage.clear();
      localStorage.setItem('b44_signed_out', '1');
    } catch {}
    appParams.token = null;
    await clearPersistedToken();
    await persistentStorage.remove('token');
    setUser(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  };

  const logout = async () => {
    await localLogout();
  };

  const loginWithEmailPassword = async ({ email, password }) => {
    setAuthError(null);
    localStorage.removeItem('b44_signed_out');
    localStorage.removeItem('base44_logged_out');

    try {
      const response = await base44.auth.loginViaEmailPassword(email, password);

      if (!response?.access_token) {
        throw new Error('Sign in failed. Please try again.');
      }

      await completeAuthSession(response.access_token, response.user);
      return response;
    } catch (error) {
      const message = getAuthErrorMessage(error);
      if (isVerificationRequiredMessage(message)) {
        throw createVerificationError(message, email);
      }
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message,
      });
      throw error;
    }
  };

  const registerWithEmailPassword = async ({ email, password, fullName }) => {
    setAuthError(null);
    localStorage.removeItem('b44_signed_out');
    localStorage.removeItem('base44_logged_out');

    try {
      const response = await base44.auth.register({
        email,
        password,
        full_name: fullName,
        name: fullName,
      });

      if (response?.access_token) {
        await completeAuthSession(response.access_token, response.user);
        return { signedIn: true, ...response };
      }

      const message = response?.message || 'Registration successful. Check your email for the verification code.';
      if (isVerificationRequiredMessage(message)) {
        throw createVerificationError(message, email);
      }

      throw new Error(message);
    } catch (error) {
      if (error.code === EMAIL_VERIFICATION_REQUIRED) {
        throw error;
      }
      const message = getAuthErrorMessage(error);
      if (isVerificationRequiredMessage(message)) {
        throw createVerificationError(message, email);
      }
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message,
      });
      throw error;
    }
  };

  const verifyEmailOtp = async ({ email, otpCode }) => {
    setAuthError(null);

    try {
      const response = await base44.auth.verifyOtp({ email, otpCode: otpCode.trim() });

      if (!response?.access_token) {
        throw new Error('Invalid verification code. Please try again.');
      }

      await completeAuthSession(response.access_token, response.user);
      return response;
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      const message = getAuthErrorMessage(error);
      setAuthError({
        type: 'auth_required',
        message,
      });
      throw error;
    }
  };

  const resendEmailOtp = async (email) => {
    return base44.auth.resendOtp(email);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      localLogout,
      manuallyLoggedOut,
      loginWithEmailPassword,
      registerWithEmailPassword,
      verifyEmailOtp,
      resendEmailOtp,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
