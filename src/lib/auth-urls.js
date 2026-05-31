import { isNativeShell } from '@/lib/native-hosted-redirect';
import { getAppScopedLoginUrl } from '@/lib/native-platform-guard';

export { RESTOREBRAINE_FROM_URL } from '@/lib/native-platform-guard';
export const getBase44LoginUrl = getAppScopedLoginUrl;

export const openBase44Login = () => {
  if (typeof window === 'undefined') return;

  const url = getBase44LoginUrl();

  try {
    if (isNativeShell()) {
      window.location.replace(url);
      return;
    }
  } catch (error) {
    console.warn('Native sign-in navigation fallback', error);
  }

  window.location.href = url;
};
