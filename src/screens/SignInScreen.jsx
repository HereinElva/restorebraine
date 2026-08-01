import { useEffect } from 'react';
import NativeLoginCard from '@/components/NativeLoginCard';

/** Omega 3 login — Google / Apple / Microsoft / email. No gallery shell. */
export default function SignInScreen({ clearSignedOut = false }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    return () => document.documentElement.removeAttribute('data-rb-screen');
  }, []);

  return <NativeLoginCard clearSignedOut={clearSignedOut} />;
}
