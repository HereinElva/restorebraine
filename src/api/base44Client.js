import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { RESTOREBRAINE_APP_URL } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  serverUrl,
  appBaseUrl: RESTOREBRAINE_APP_URL,
  token,
  functionsVersion,
  requiresAuth: false
});
