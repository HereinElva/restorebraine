import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isNativeShell } from '@/lib/native-hosted-redirect';
import { isAppHost } from '@/lib/app-domains';
import { isBase44PlatformHost } from '@/lib/native-platform-guard';

/** v4-core must run on capacitor://localhost (or https://localhost), never hosted Base44. */
export const isV4CoreBundledOrigin = () => {
  if (typeof window === 'undefined') return true;
  try {
    const { protocol, hostname } = window.location;
    if (protocol === 'capacitor:' || protocol === 'ionic:') return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
};

/** True when v4-core build loaded the wrong page (hosted site or platform login in main WebView). */
export const isV4CoreWrongOrigin = () => {
  if (!LOCAL_NATIVE_BUNDLE || !isNativeShell()) return false;
  if (isV4CoreBundledOrigin()) return false;
  try {
    const { hostname } = window.location;
    return isAppHost(hostname) || isBase44PlatformHost(hostname);
  } catch {
    return true;
  }
};

export const getV4CoreOriginLabel = () => {
  if (typeof window === 'undefined') return 'unknown';
  return window.location.origin;
};
