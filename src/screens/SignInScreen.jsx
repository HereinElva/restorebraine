import { useEffect } from 'react';
import NativeLoginCard from '@/components/NativeLoginCard';

/**
 * Web + native → NativeLoginCard (Google / Apple / Microsoft / email).
 * Hosted App Store builds load live Base44 — same card after Publish.
 */
export default function SignInScreen({ clearSignedOut = false }) {
  const { navigateToLogin } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

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
