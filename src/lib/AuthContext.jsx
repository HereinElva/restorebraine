import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { openRestorebraineLogin } from '@/lib/auth-urls';
import { getAppOrigin } from '@/lib/app-params';
import { clearNativeSession, persistSessionToNativeStorage, restoreSessionFromNativeStorage, ensureClientSessionToken } from '@/lib/session-bootstrap';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';

const AUTH_BOOT_TIMEOUT_MS = 12000;
const AUTH_API_TIMEOUT_MS = 10000;

const withAuthTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(Object.assign(new Error(`${label} timed out`), { status: 408 }));
      }, ms);
    }),
  ]);

const isBundledNativeShell = () => {
  try {
    if (typeof __RESTOREBRAINE_NATIVE_LOCAL__ !== 'undefined' && __RESTOREBRAINE_NATIVE_LOCAL__) {
      return true;
    }
    const p = window.location?.protocol;
    return p === 'capacitor:' || p === 'ionic:';
  } catch {
    return false;
  }
};

const hasStoredAuthToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return false;
    return Boolean(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};

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
    let finished = false;
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthError((current) => current ?? { type: 'auth_required', message: 'Session check timed out' });
    }, AUTH_BOOT_TIMEOUT_MS);

    try {
      setIsLoadingPublicSettings(true);
      setIsLoadingAuth(true);
      setAuthError(null);

      ensureClientSessionToken();

      const restoredToken = await withAuthTimeout(
        restoreSessionFromNativeStorage(),
        4000,
        'restoreSessionFromNativeStorage',
      ).catch(() => null);
      if (restoredToken) {
        appParams.token = restoredToken;
      } else if (hasStoredAuthToken()) {
        appParams.token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      }

      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await withAuthTimeout(
          appClient.get(`/prod/public-settings/by-id/${appParams.appId}`),
          AUTH_API_TIMEOUT_MS,
          'public-settings',
        );
        if (finished) return;
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        if (finished) return;
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
        } else {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }

        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      if (finished) return;
      console.error('Unexpected error:', error);
      setAuthError({ type: 'auth_required', message: error.message || 'Authentication required' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    } finally {
      finished = true;
      window.clearTimeout(timeout);
    }
  };

  const checkUserAuth = async ({ ignoreManualLogout = false, silent = false } = {}) => {
    if (manuallyLoggedOut && !ignoreManualLogout) return;

    try {
      if (!silent) setIsLoadingAuth(true);
      const currentUser = await withAuthTimeout(base44.auth.me(), AUTH_API_TIMEOUT_MS, 'auth.me');
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);

      const token = appParams.token || localStorage.getItem('base44_access_token') || localStorage.getItem('token');
      if (token) {
        await persistSessionToNativeStorage(token);
      }
    } catch (error) {
      console.error('User auth check failed:', error);

      if (error.status === 401) {
        const restoredToken = await withAuthTimeout(
          restoreSessionFromNativeStorage(),
          4000,
          'restoreSessionFromNativeStorage',
        ).catch(() => null);
        if (restoredToken) {
          try {
            const currentUser = await withAuthTimeout(base44.auth.me(), AUTH_API_TIMEOUT_MS, 'auth.me');
            setUser(currentUser);
            setIsAuthenticated(true);
            setAuthError(null);
            setIsLoadingAuth(false);
            await persistSessionToNativeStorage(restoredToken);
            return;
          } catch (retryError) {
            console.warn('Auth retry after session restore failed:', retryError);
          }
        }
      }

      if (error.status === 401 || error.status === 408) {
        await clearNativeSession().catch(() => {});
      }

      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 408) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else if (error.status === 403) {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      } else if (isBundledNativeShell()) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
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

  const resumeActiveSession = async () => {
    setManuallyLoggedOut(false);
    setAuthError(null);

    const restoredToken = await restoreSessionFromNativeStorage();
    if (restoredToken) {
      appParams.token = restoredToken;
    }

    const token =
      appParams.token ||
      localStorage.getItem('base44_access_token') ||
      localStorage.getItem('token');

    if (!token) return false;

    try {
      localStorage.removeItem('b44_signed_out');
    } catch {}

    await persistSessionToNativeStorage(token);
    await checkUserAuth({ ignoreManualLogout: true, silent: true });
    return true;
  };

  useEffect(() => {
    const onSessionUpdated = () => {
      if (!hasStoredAuthToken()) return;
      void resumeActiveSession();
    };

    window.addEventListener('restorebraine-session-updated', onSessionUpdated);
    window.addEventListener('restorebraine-native-oauth-complete', onSessionUpdated);
    window.addEventListener('focus', onSessionUpdated);
    const onVisible = () => {
      if (document.visibilityState === 'visible') onSessionUpdated();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('restorebraine-session-updated', onSessionUpdated);
      window.removeEventListener('restorebraine-native-oauth-complete', onSessionUpdated);
      window.removeEventListener('focus', onSessionUpdated);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const logout = async () => {
    await localLogout();
    if (isHostedAppOrigin()) {
      window.location.href = `${getAppOrigin()}/api/apps/auth/logout?from_url=${encodeURIComponent(window.location.href)}`;
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
      resumeActiveSession,
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
