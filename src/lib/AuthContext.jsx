import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { clearPersistedToken } from '@/lib/app-params';
import { appParams } from '@/lib/app-params';
import { persistentStorage } from '@/lib/persistentStorage';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [manuallyLoggedOut, setManuallyLoggedOut] = useState(false); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    if (localStorage.getItem("b44_signed_out") === "1") { setIsLoadingPublicSettings(false); setIsLoadingAuth(false); setAuthError({ type: "auth_required", message: "Authentication required" }); return; }
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
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
        
        // Handle app-level errors
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
        } else {
          // Network error or transient failure — if we have a stored token, still try to auth
          // This prevents logging users out on flaky connections or app resume
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

  const checkUserAuth = async () => {
    if (manuallyLoggedOut) return;
    if (localStorage.getItem("b44_signed_out") === "1") { setIsLoadingAuth(false); setIsAuthenticated(false); setAuthError({ type: "auth_required", message: "Authentication required" }); return; }
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    await clearPersistedToken();
      
      // Only redirect to login on 401 (unauthenticated).
      // 403 means the user IS authenticated but not registered/invited — show that error instead.
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
    setIsLoadingAuth(true);
    setAuthError(null);
    localStorage.removeItem('b44_signed_out');
    localStorage.removeItem('base44_logged_out');

    try {
      const authClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api`,
        headers: { 'X-App-Id': appParams.appId },
        interceptResponses: true,
      });
      const response = await authClient.post(`/apps/${appParams.appId}/auth/login`, { email, password });

      if (!response?.access_token) {
        throw new Error('Sign in failed. Please try again.');
      }

      await persistAccessToken(response.access_token);
      setManuallyLoggedOut(false);
      setUser(response.user ?? null);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      await checkUserAuth();
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error?.data?.message || error?.message || 'Invalid email or password',
      });
      throw error;
    }
  };

  const registerWithEmailPassword = async ({ email, password, fullName }) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    localStorage.removeItem('b44_signed_out');
    localStorage.removeItem('base44_logged_out');

    try {
      const authClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api`,
        headers: { 'X-App-Id': appParams.appId },
        interceptResponses: true,
      });
      const response = await authClient.post(`/apps/${appParams.appId}/auth/register`, {
        email,
        password,
        full_name: fullName,
        name: fullName,
      });

      if (response?.access_token) {
        await persistAccessToken(response.access_token);
        setManuallyLoggedOut(false);
        setUser(response.user ?? null);
        setIsAuthenticated(true);
        setAuthError(null);
        await checkUserAuth();
      } else {
        setAuthError({ type: 'auth_required', message: 'Account created. Please sign in.' });
      }

      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      return response;
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error?.data?.message || error?.message || 'Unable to create account',
      });
      throw error;
    }
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