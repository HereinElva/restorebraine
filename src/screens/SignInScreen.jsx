import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import NativeLoginCard from '@/components/NativeLoginCard';
import NativeDebugBadge from '@/components/NativeDebugBadge';

/**
 * Web + native bundled → NativeLoginCard (Google / Apple / Microsoft / email).
 * Native hosted → simple Sign in button → platform login.
 */
export default function SignInScreen({ clearSignedOut = false }) {
  const { navigateToLogin } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

  if (isNativeShell() && (!LOCAL_NATIVE_BUNDLE || isHostedAppOrigin())) {
    return (
      <main id="restorebraine-signin" className="rb-signin" data-rb-auth="sign-in-v4">
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

  return <NativeLoginCard clearSignedOut={clearSignedOut} />;
}

export const hasStoredSessionToken = () => {
  try {
    if (localStorage.getItem('b44_signed_out') === '1') return false;
    return Boolean(localStorage.getItem('base44_access_token') || localStorage.getItem('token'));
  } catch {
    return false;
  }
};
