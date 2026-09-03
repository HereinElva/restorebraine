import { useEffect, useState } from 'react';
import { DEPLOY_BUILD } from '@/deploy-marker';
import { BUILD_NUMBER, NATIVE_BUILD_LABEL } from '@/lib/build-info';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';

/** Visible on Account — proves what the WebView is actually running (audits cannot see this). */
export default function RuntimeDiagnostic() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const moduleScript = document.querySelector('script[type="module"]')?.getAttribute('src') || '?';
    const deployMeta =
      document.querySelector('meta[name="restorebraine-deploy"]')?.getAttribute('content') || '?';

    setInfo({
      origin: window.location.origin,
      host: window.location.hostname,
      deployMeta,
      gitDeploy: `v${DEPLOY_BUILD}`,
      buildNumber: BUILD_NUMBER,
      moduleScript,
      nativeShell: isNativeShell(),
      hostedOrigin: isHostedAppOrigin(),
      nativeBuild: window.__RESTOREBRAINE_NATIVE_BUILD__ || NATIVE_BUILD_LABEL,
      stripePatch: window.__restorebraineStripePatchVersion ?? '?',
      stripeError: window.__restorebraineLastStripeError || '',
      folderClaim: window.__restorebraineFolderClaimStatus || '',
      inAppBrowser: !!window.Capacitor?.Plugins?.InAppBrowser?.openInWebView,
    });
  }, []);

  if (!info) return null;

  const mode = info.hostedOrigin
    ? 'HOSTED (loads live Base44 UI)'
    : info.nativeShell
      ? 'BUNDLED (capacitor://localhost — ignores Base44 Publish)'
      : 'WEB BROWSER';

  const deployOk = info.deployMeta === info.gitDeploy;
  const originOk = info.hostedOrigin || !info.nativeShell;

  return (
    <div className="mt-6 p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs font-mono space-y-1 break-all">
      <p className="font-sans font-semibold text-gray-900 text-sm mb-2">Runtime diagnostic</p>
      <p>
        Mode: <span className={originOk ? 'text-green-700' : 'text-red-600 font-bold'}>{mode}</span>
      </p>
      <p>
        origin: <span className={originOk ? '' : 'text-red-600 font-bold'}>{info.origin}</span>
      </p>
      <p>
        deploy meta:{' '}
        <span className={deployOk ? 'text-green-700' : 'text-red-600 font-bold'}>
          {info.deployMeta} (git {info.gitDeploy})
        </span>
      </p>
      <p>JS bundle: {info.moduleScript}</p>
      <p>native stamp: {info.nativeBuild}</p>
      <p>InAppBrowser: {info.inAppBrowser ? 'ok' : 'MISSING'}</p>
      {info.stripeError ? <p className="text-red-600">stripe: {info.stripeError}</p> : null}
      {info.folderClaim ? <p className="text-orange-700">folders: {info.folderClaim}</p> : null}
      {!originOk ? (
        <p className="text-red-600 font-sans pt-2">
          Wrong mode — run: bash scripts/mac-build.sh --hosted --no-git, delete app, Xcode Run.
        </p>
      ) : null}
    </div>
  );
}
