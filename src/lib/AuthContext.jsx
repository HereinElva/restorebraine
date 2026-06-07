import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { openRestorebraineLogin } from '@/lib/auth-urls';
import { RESTOREBRAINE_APP_URL } from '@/lib/app-params';
import { clearNativeSession, persistSessionToNativeStorage, restoreSessionFromNativeStorage } from '@/lib/session-bootstrap';
import { isHostedAppOrigin } from '@/lib/native-hosted-redirect';

const AuthContext = createContext();

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
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const restoredToken = await restoreSessionFromNativeStorage();
      if (restoredToken) {
        appParams.token = restoredToken;
      }

      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
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
        } else if (appError.status === 403) {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        } else if (appParams.token) {
          await checkUserAuth();
        }

        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    if (manuallyLoggedOut) return;

    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);

      const token = appParams.token || localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (token) {
        await persistSessionToNativeStorage(token);
      }
    } catch (error) {
      console.error('User auth check failed:', error);

      if (error.status === 401) {
        const restoredToken = await restoreSessionFromNativeStorage();
        if (restoredToken) {
          try {
            const currentUser = await base44.auth.me();
            setUser(currentUser);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            await persistSessionToNativeStorage(restoredToken);
            return;
          } catch (retryError) {
            console.warn('Auth retry after session restore failed:', retryError);
          }
        }
      }

      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      if (error.status === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else if (error.status === 403) {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      }
    }
  };

  const localLogout = async () => {
    setManuallyLoggedOut(true);
    await clearNativeSession();
    setUser(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  };

  const logout = async () => {
    await localLogout();
    if (isHostedAppOrigin()) {
      window.location.href = `${RESTOREBRAINE_APP_URL}/api/apps/auth/logout?from_url=${encodeURIComponent(window.location.href)}`;
    }
  };

  const navigateToLogin = () => {
    setManuallyLoggedOut(false);
    openRestorebraineLogin();
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
      navigateToLogin,
      checkAppState,
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
