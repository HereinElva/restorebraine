import { BASE44_APP_ID } from '@/lib/app-params';
import { isNativeShell } from '@/lib/native-hosted-redirect';

export const RESTOREBRAINE_FROM_URL = 'https://restorebraine.base44.app';

export const getBase44LoginUrl = () => {
  const params = new URLSearchParams({
    from_url: RESTOREBRAINE_FROM_URL,
    app_id: BASE44_APP_ID,
    prompt: 'select_account',
  });
  return `https://app.base44.com/login?${params.toString()}`;
};

export const openBase44Login = () => {
  if (typeof window === 'undefined') return;

  const url = getBase44LoginUrl();

  try {
    if (isNativeShell()) {
      // Same-window navigation keeps Google OAuth inside the Capacitor WebView.
      window.location.replace(url);
      return;
    }
  } catch (error) {
    console.warn('Native sign-in navigation fallback', error);
  }

  window.location.href = url;
};
