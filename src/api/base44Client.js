import { createClient } from '@base44/sdk';
import { appParams, getAppOrigin } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  serverUrl,
  appBaseUrl: getAppOrigin(),
  token,
  functionsVersion,
  requiresAuth: false
});
