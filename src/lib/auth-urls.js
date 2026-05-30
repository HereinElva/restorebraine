import { BASE44_APP_ID } from '@/lib/app-params';

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
  window.location.href = getBase44LoginUrl();
};
