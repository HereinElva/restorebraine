import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { openRestorebraineLogin } from '@/lib/auth-urls';
import { getAppOrigin } from '@/lib/app-params';
import { clearNativeSession, persistSessionToNativeStorage, restoreSessionFromNativeStorage, ensureClientSessionToken, normalizeAuthEmail, prepareForNewRegistration, clearAxiosAuthHeaders } from '@/lib/session-bootstrap';
import {
  postAuthEmail,
  verifyAuthOtp,
  resendAuthOtp,
  extractAuthAccessToken,
  isOtpVerifiedResponse,
  isVerificationRequiredResponse,
  isVerificationPendingError,
  verificationRequiredError,
} from '@/lib/auth-email-api';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { resetToGalleryHome } from '@/lib/gallery-nav';

const AUTH_BOOT_TIMEOUT_MS = 12000;
const AUTH_BOOT_TIMEOUT_BUNDLED_MS = 6000;
const AUTH_API_TIMEOUT_MS = 10000;
const AUTH_REGISTER_TIMEOUT_MS = 20000;

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
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [manuallyLoggedOut, setManuallyLoggedOut] = useState(false);
  const authBootInFlightRef = useRef(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const finishAuthBoot = ({ loadingAuth = false, error = null } = {}) => {
    authBootInFlightRef.current = false;
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(loadingAuth);
    if (error) {
      setAuthError(error);
    }
  };

  const checkAppState = async () => {
    let finished = false;
    authBootInFlightRef.current = true;
    const bootTimeoutMs = isBundledNativeShell() ? AUTH_BOOT_TIMEOUT_BUNDLED_MS : AUTH_BOOT_TIMEOUT_MS;
    const timeout = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      if (hasStoredAuthToken()) {
        finishAuthBoot();
        void checkUserAuth({ ignoreManualLogout: true, silent: true });
        return;
      }
      finishAuthBoot({
        error: { type: 'auth_required', message: 'Session check timed out' },
      });
    }, bootTimeoutMs);

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      ensureClientSessionToken();

      // Bundled + no token: show SignInScreen immediately (don't wait on public-settings API)
      if (isBundledNativeShell() && !hasStoredAuthToken()) {
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        finishAuthBoot();
        finished = true;
        window.clearTimeout(timeout);
        void withAuthTimeout(
          createAxiosClient({
            baseURL: `${appParams.serverUrl}/api/apps/public`,
            headers: { 'X-App-Id': appParams.appId },
            token: appParams.token,
            interceptResponses: true,
          }).get(`/prod/public-settings/by-id/${appParams.appId}`),
          AUTH_API_TIMEOUT_MS,
          'public-settings-background',
        )
          .then((publicSettings) => setAppPublicSettings(publicSettings))
          .catch(() => {});
        return;
      }

      // Bundled + token: show gallery immediately; validate session in background (Omega 3).
      if (isBundledNativeShell() && hasStoredAuthToken()) {
        setManuallyLoggedOut(false);
        setIsAuthenticated(true);
        setAuthError(null);
        finishAuthBoot();
        finished = true;
        window.clearTimeout(timeout);
        try {
          window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', {
            detail: { token: appParams.token || localStorage.getItem('base44_access_token') },
          }));
        } catch {}
        void checkUserAuth({ ignoreManualLogout: true, silent: true });
        void withAuthTimeout(
          createAxiosClient({
            baseURL: `${appParams.serverUrl}/api/apps/public`,
            headers: { 'X-App-Id': appParams.appId },
            token: appParams.token,
            interceptResponses: true,
          }).get(`/prod/public-settings/by-id/${appParams.appId}`),
          AUTH_API_TIMEOUT_MS,
          'public-settings-background',
        )
          .then((publicSettings) => setAppPublicSettings(publicSettings))
          .catch(() => {});
        return;
      }

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
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }

        if (!finished) {
          finishAuthBoot();
        }
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

        finishAuthBoot();
      }
    } catch (error) {
      if (finished) return;
      console.error('Unexpected error:', error);
      finishAuthBoot({
        error: { type: 'auth_required', message: error.message || 'Authentication required' },
      });
    } finally {
      finished = true;
      window.clearTimeout(timeout);
      authBootInFlightRef.current = false;
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async ({ ignoreManualLogout = false, silent = false } = {}) => {
    if (manuallyLoggedOut && !ignoreManualLogout) {
      if (!silent) setIsLoadingAuth(false);
      return;
    }

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
        await clearNativeSession().catch(() => {});
      } else if (error.status === 408 && isBundledNativeShell() && hasStoredAuthToken()) {
        // Slow network on native — keep gallery open when a token is still stored.
        if (!silent) setIsLoadingAuth(false);
        return;
      }

      setIsLoadingAuth(false);

      if (error.status === 401) {
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else if (error.status === 403) {
        setIsAuthenticated(false);
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      } else if (isBundledNativeShell() && hasStoredAuthToken()) {
        setIsAuthenticated(true);
      } else if (isBundledNativeShell()) {
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setIsAuthenticated(false);
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
    const onSessionUpdated = (event) => {
      try {
        const token =
          event?.detail?.token ||
          (localStorage.getItem('b44_signed_out') === '1'
            ? null
            : (localStorage.getItem('base44_access_token') || localStorage.getItem('token')));
        if (token) {
          appParams.token = token;
          ensureClientSessionToken();
          setManuallyLoggedOut(false);
          setIsAuthenticated(true);
          setAuthError(null);
          resetToGalleryHome();
        }
      } catch {}
      void checkUserAuth({ ignoreManualLogout: true, silent: true });
    };

    window.addEventListener('restorebraine-session-updated', onSessionUpdated);
    window.addEventListener('restorebraine-native-oauth-complete', onSessionUpdated);

    const onSignedOut = () => {
      setManuallyLoggedOut(true);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    };
    window.addEventListener('restorebraine-signed-out', onSignedOut);

    return () => {
      window.removeEventListener('restorebraine-session-updated', onSessionUpdated);
      window.removeEventListener('restorebraine-native-oauth-complete', onSessionUpdated);
      window.removeEventListener('restorebraine-signed-out', onSignedOut);
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

  const loginWithEmailPassword = async ({ email, password }) => {
    setAuthError(null);
    try { localStorage.removeItem('b44_signed_out'); } catch {}

    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail || !password) {
      throw Object.assign(new Error('Enter your email and password.'), { status: 400 });
    }

    clearAxiosAuthHeaders();

    try {
      const response = await withAuthTimeout(
        postAuthEmail('login', { email: normalizedEmail, password }),
        AUTH_API_TIMEOUT_MS,
        'auth.login',
      );

      if (!response?.access_token) {
        throw new Error('Sign in failed. Please try again.');
      }

      await persistSessionToNativeStorage(response.access_token);
      setManuallyLoggedOut(false);
      setUser(response.user ?? null);
      setIsAuthenticated(true);
      finishAuthBoot();
      setAuthError(null);
      resetToGalleryHome();
      try {
        window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: response.access_token } }));
        window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: { token: response.access_token } }));
      } catch {}
      void checkUserAuth({ ignoreManualLogout: true, silent: true });
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      if (isVerificationPendingError(error)) {
        throw verificationRequiredError(
          normalizedEmail,
          'Your email is not verified yet. Enter the verification code sent to your inbox.',
        );
      }
      setAuthError({
        type: 'auth_required',
        message: error?.data?.message || error?.message || 'Invalid email or password',
      });
      throw error;
    }
  };

  const verifyEmailOtp = async ({ email, otpCode, password }) => {
    setAuthError(null);
    const normalizedEmail = normalizeAuthEmail(email);
    const code = String(otpCode || '').trim();
    if (!normalizedEmail || !code) {
      throw Object.assign(new Error('Enter the verification code from your email.'), { status: 400 });
    }

    clearAxiosAuthHeaders();

    try {
      const verifyResponse = await withAuthTimeout(
        verifyAuthOtp(normalizedEmail, code),
        AUTH_API_TIMEOUT_MS,
        'auth.verify-otp',
      );

      let accessToken = extractAuthAccessToken(verifyResponse);
      let user = verifyResponse?.user ?? null;

      if (!accessToken) {
        if (!isOtpVerifiedResponse(verifyResponse)) {
          throw new Error('Invalid verification code. Check the code from your email and try again.');
        }
        if (!password) {
          throw Object.assign(
            new Error('Enter the password you used when signing up, then tap Verify again.'),
            { status: 400, code: 'PASSWORD_REQUIRED' },
          );
        }

        const loginResponse = await withAuthTimeout(
          postAuthEmail('login', { email: normalizedEmail, password }),
          AUTH_API_TIMEOUT_MS,
          'auth.login',
        );
        accessToken = extractAuthAccessToken(loginResponse);
        user = loginResponse?.user ?? user;
      }

      if (!accessToken) {
        throw new Error('Verification succeeded but sign-in failed. Check your password and try again.');
      }

      await persistSessionToNativeStorage(accessToken);
      setManuallyLoggedOut(false);
      setUser(user);
      setIsAuthenticated(true);
      finishAuthBoot();
      setAuthError(null);
      resetToGalleryHome();
      try {
        window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: accessToken } }));
        window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: { token: accessToken } }));
      } catch {}
      void checkUserAuth({ ignoreManualLogout: true, silent: true });
      return { ...verifyResponse, access_token: accessToken, user };
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error?.data?.message || error?.message || 'Invalid verification code',
      });
      throw error;
    }
  };

  const resendEmailVerification = async ({ email }) => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail) {
      throw Object.assign(new Error('Enter your email address.'), { status: 400 });
    }
    await withAuthTimeout(
      resendAuthOtp(normalizedEmail),
      AUTH_API_TIMEOUT_MS,
      'auth.resend-otp',
    );
    return { ok: true, email: normalizedEmail };
  };

  const registerWithEmailPassword = async ({ email, password, fullName }) => {
    setAuthError(null);

    const normalizedEmail = normalizeAuthEmail(email);
    const trimmedName = String(fullName || '').trim();
    if (!normalizedEmail || !password) {
      throw Object.assign(new Error('Enter your email and password.'), { status: 400 });
    }
    if (!trimmedName) {
      throw Object.assign(new Error('Enter your name to create an account.'), { status: 400 });
    }

    await prepareForNewRegistration();

    const finishRegistrationSuccess = async (response) => {
      if (!response?.access_token) {
        throw Object.assign(
          new Error('Account created but sign-in failed. Try signing in with your email and password.'),
          { status: 401 },
        );
      }
      await persistSessionToNativeStorage(response.access_token);
      setManuallyLoggedOut(false);
      setUser(response.user ?? null);
      setIsAuthenticated(true);
      setAuthError(null);
      finishAuthBoot();
      resetToGalleryHome();
      try {
        window.dispatchEvent(new CustomEvent('restorebraine-session-updated', { detail: { token: response.access_token } }));
        window.dispatchEvent(new CustomEvent('restorebraine-gallery-ready', { detail: { token: response.access_token } }));
      } catch {}
      void checkUserAuth({ ignoreManualLogout: true, silent: true });
      return response;
    };

    try {
      let response = await withAuthTimeout(
        postAuthEmail('register', {
          email: normalizedEmail,
          password,
          full_name: trimmedName,
          name: trimmedName,
        }),
        AUTH_REGISTER_TIMEOUT_MS,
        'auth.register',
      );

      if (response?.access_token) {
        return finishRegistrationSuccess(response);
      }

      if (isVerificationRequiredResponse(response)) {
        throw verificationRequiredError(normalizedEmail);
      }

      try {
        response = await withAuthTimeout(
          postAuthEmail('login', { email: normalizedEmail, password }),
          AUTH_API_TIMEOUT_MS,
          'auth.login',
        );
        if (response?.access_token) {
          return finishRegistrationSuccess(response);
        }
      } catch (loginError) {
        if (isVerificationPendingError(loginError)) {
          throw verificationRequiredError(normalizedEmail);
        }
      }

      throw verificationRequiredError(
        normalizedEmail,
        'Account created. Check your email for a verification code to finish signing up.',
      );
    } catch (error) {
      const rawMessage = error?.data?.message || error?.message || 'Unable to create account';

      if (error?.code === 'VERIFICATION_REQUIRED') {
        throw error;
      }

      if (/already exists/i.test(rawMessage)) {
        try {
          const loginResponse = await withAuthTimeout(
            postAuthEmail('login', { email: normalizedEmail, password }),
            AUTH_API_TIMEOUT_MS,
            'auth.login',
          );
          if (loginResponse?.access_token) {
            return finishRegistrationSuccess(
              Object.assign(loginResponse, {
                user: loginResponse.user,
                recoveredExistingAccount: true,
              }),
            );
          }
        } catch (loginError) {
          if (isVerificationPendingError(loginError)) {
            try {
              await resendAuthOtp(normalizedEmail);
            } catch {
              /* resend optional */
            }
            throw verificationRequiredError(
              normalizedEmail,
              'That email is already registered but not verified yet. Enter the code from your email, or sign in if you already verified.',
            );
          }
        }

        try {
          await resendAuthOtp(normalizedEmail);
          throw verificationRequiredError(
            normalizedEmail,
            'That email may already be registered. If you received a verification code, enter it below. Otherwise sign in with your password.',
          );
        } catch (resendError) {
          if (resendError?.code === 'VERIFICATION_REQUIRED') throw resendError;
        }
      }

      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      const message = /timed out/i.test(rawMessage)
        ? 'Registration timed out. If this email was already created, try signing in instead.'
        : /already exists/i.test(rawMessage)
          ? 'That email is already registered. Sign in with your password, or enter a verification code if you received one.'
          : rawMessage;
      setAuthError({
        type: 'auth_required',
        message,
      });
      throw Object.assign(error, { message, data: { ...(error?.data || {}), message } });
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
      resumeActiveSession,
      manuallyLoggedOut,
      navigateToLogin,
      loginWithEmailPassword,
      registerWithEmailPassword,
      verifyEmailOtp,
      resendEmailVerification,
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
