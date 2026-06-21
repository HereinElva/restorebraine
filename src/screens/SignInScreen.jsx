import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import NativeLoginCard from '@/components/NativeLoginCard';
import NativeDebugBadge from '@/components/NativeDebugBadge';

/**
 * Web → Base44 platform login (Google / Apple / email on one page).
 * Native bundled → NativeLoginCard with all options in-app.
 * Native hosted → simple Sign in button → platform login.
 */
export default function SignInScreen({ clearSignedOut = false }) {
  const { navigateToLogin } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

  useEffect(() => {
    if (isNativeShell()) return;
    if (started.current) return;
    started.current = true;
    if (clearSignedOut) {
      try {
        localStorage.removeItem('b44_signed_out');
      } catch {
        /* ignore */
      }
    }
    navigateToLogin();
  }, [navigateToLogin, clearSignedOut]);

  if (!isNativeShell()) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 gap-4">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading sign in…</p>
      </div>
    );
  }

  if (LOCAL_NATIVE_BUNDLE && !isHostedAppOrigin()) {
    return <NativeLoginCard clearSignedOut={clearSignedOut} />;
  }

  return (
    <main
      id="restorebraine-signin"
      className="rb-signin"
      data-rb-auth="sign-in-v4"
    >
      <section className="rb-signin-card">
        <h1 className="rb-signin-title">Restorebraine</h1>
        <button
          type="button"
          className="rb-signin-google"
          onClick={() => {
            if (clearSignedOut) {
              try {
                localStorage.removeItem('b44_signed_out');
              } catch {
                /* ignore */
              }
            }
            navigateToLogin();
          }}
        >
          Sign in
        </button>
      </section>
      <NativeDebugBadge />
    </main>
  );
}

export const hasStoredSessionToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return false;
    return Boolean(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};
