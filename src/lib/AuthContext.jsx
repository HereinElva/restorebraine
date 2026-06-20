import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { openRestorebraineLogin } from '@/lib/auth-urls';
import { getAppOrigin } from '@/lib/app-params';
import { clearNativeSession, persistSessionToNativeStorage, restoreSessionFromNativeStorage } from '@/lib/session-bootstrap';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';

const AUTH_TIMEOUT_MS = 8000;
const NATIVE_AUTH_TIMEOUT_MS = 4000;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { status: 408 })), ms);
    }),
  ]);

const readSyncToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return null;
    return localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  } catch {
    return null;
  }
};

const isNativeLocalShell = () => LOCAL_NATIVE_BUNDLE || (isNativeShell() && !isHostedAppOrigin());

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

  useEffect(() => {
    const onSessionUpdated = () => {
      checkAppState();
    };
    window.addEventListener('restorebraine-session-updated', onSessionUpdated);
    return () => window.removeEventListener('restorebraine-session-updated', onSessionUpdated);
  }, []);

  // Avoid an infinite spinner if the Base44 API never responds (common on flaky mobile).
  useEffect(() => {
    let cancelled = false;
    const timeoutMs = isNativeLocalShell() ? NATIVE_AUTH_TIMEOUT_MS : AUTH_TIMEOUT_MS;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setIsLoadingPublicSettings((loading) => {
        if (loading) {
          setIsLoadingAuth(false);
          setAuthError((err) => err ?? { type: 'auth_required', message: 'Session check timed out' });
        }
        return false;
      });
      setIsLoadingAuth((loading) => {
        if (loading) {
          setIsLoadingPublicSettings(false);
          setAuthError((err) => err ?? { type: 'auth_required', message: 'Session check timed out' });
        }
        return false;
      });
    }, timeoutMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const checkAppState = async () => {
    try {
      const syncToken = readSyncToken();

      if (LOCAL_NATIVE_BUNDLE && !syncToken) {
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        restoreSessionFromNativeStorage()
          .then((token) => {
            if (token) {
              appParams.token = token;
              window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token } }));
            }
          })
          .catch(() => {});
        return;
      }

      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const restoredToken = await restoreSessionFromNativeStorage();
      if (restoredToken) {
        appParams.token = restoredToken;
      }

      const tokenAfterRestore = readSyncToken() || appParams.token;
      if (LOCAL_NATIVE_BUNDLE && !tokenAfterRestore) {
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return;
      }

      const appClient = createAxiosClient({
        baseURL: `${appParams.serverUrl}/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true,
      });

      try {
        const publicSettings = await withTimeout(
          appClient.get(`/prod/public-settings/by-id/${appParams.appId}`),
          isNativeLocalShell() ? NATIVE_AUTH_TIMEOUT_MS : AUTH_TIMEOUT_MS,
          'Public settings',
        );
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
        } else {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }

        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'auth_required', message: error.message || 'Authentication required' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async ({ ignoreManualLogout = false } = {}) => {
    if (manuallyLoggedOut && !ignoreManualLogout) return;

    try {
      setIsLoadingAuth(true);
      const currentUser = await withTimeout(
        base44.auth.me(),
        isNativeLocalShell() ? NATIVE_AUTH_TIMEOUT_MS : AUTH_TIMEOUT_MS,
        'Auth check',
      );
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
    await checkUserAuth({ ignoreManualLogout: true });
    return true;
  };

  const logout = async () => {
    await localLogout();
    if (isHostedAppOrigin()) {
      window.location.href = `${getAppOrigin()}/api/apps/auth/logout?from_url=${encodeURIComponent(window.location.href)}`;
    }
  };

  const loginWithEmailPassword = async ({ email, password }) => {
    setAuthError(null);
    try { localStorage.removeItem('b44_signed_out'); } catch {}
    try { localStorage.removeItem('base44_logged_out'); } catch {}

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

      await persistSessionToNativeStorage(response.access_token);
      setManuallyLoggedOut(false);
      setUser(response.user ?? null);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      await checkUserAuth({ ignoreManualLogout: true });
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
    setAuthError(null);
    try { localStorage.removeItem('b44_signed_out'); } catch {}
    try { localStorage.removeItem('base44_logged_out'); } catch {}

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
        await persistSessionToNativeStorage(response.access_token);
        setManuallyLoggedOut(false);
        setUser(response.user ?? null);
        setIsAuthenticated(true);
        setAuthError(null);
        await checkUserAuth({ ignoreManualLogout: true });
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

  const navigateToLogin = () => {
    setManuallyLoggedOut(false);
    // v4-core: show bundled NativeLoginCard — do not auto-open Safari sheet.
    if (LOCAL_NATIVE_BUNDLE && isNativeShell() && !isHostedAppOrigin()) {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
      return;
    }
    if (isNativeShell() && !isHostedAppOrigin()) {
      openRestorebraineLogin();
      return;
    }
    base44.auth.redirectToLogin(window.location.href);
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
      loginWithEmailPassword,
      registerWithEmailPassword,
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
