import { useMemo, useState } from 'react';
import { BUILD_NUMBER, NATIVE_BUILD_LABEL } from '@/lib/build-info';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';
import { isV4CoreWrongOrigin } from '@/lib/v4-core-guard';

const getModeLabel = () => {
  if (!isNativeShell()) return 'web';
  if (isHostedAppOrigin()) return 'native-hosted';
  if (LOCAL_NATIVE_BUNDLE) return 'v4-core';
  return 'native';
};

export default function NativeDebugBadge() {
  const [expanded, setExpanded] = useState(false);

  const info = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const nativeStamp = typeof window !== 'undefined' ? window.__RESTOREBRAINE_NATIVE_BUILD__ : '';
    const entryScript = typeof document !== 'undefined'
      ? [...document.querySelectorAll('script[src*="assets/"]')]
          .map((el) => el.getAttribute('src')?.split('/').pop())
          .find(Boolean) ?? 'unknown'
      : 'unknown';
    const htmlStamp = typeof document !== 'undefined'
      ? document.querySelector('meta[name="restorebraine-build-stamp"]')?.getAttribute('content') ?? ''
      : '';
    const bridgeSource = typeof window !== 'undefined' ? window.__RESTOREBRAINE_V4_BRIDGE_SOURCE__ : '';
    const bridgeInstalled = typeof window !== 'undefined' && window.__restorebraineSessionBridgeInstalled;
    const stampMismatch = htmlStamp && !htmlStamp.includes(`v${BUILD_NUMBER}`);
    const wrongOrigin = isV4CoreWrongOrigin();
    const authLayer = typeof document !== 'undefined'
      ? document.querySelector('[data-rb-auth]')?.getAttribute('data-rb-auth') ?? 'none'
      : 'none';
    const oldLoginUi = typeof document !== 'undefined'
      && /sign in to access your memories/i.test(document.body?.innerText ?? '');
    return {
      mode: getModeLabel(),
      origin,
      wrongOrigin,
      nativeStamp: nativeStamp || NATIVE_BUILD_LABEL,
      entryScript,
      htmlStamp,
      bridgeSource,
      bridgeInstalled,
      stampMismatch,
      authLayer,
      oldLoginUi,
    };
  }, []);

  if (!isNativeShell()) return null;

  return (
    <button
      type="button"
      id="rb-native-stamp"
      onClick={() => setExpanded((v) => !v)}
      style={{
        position: 'fixed',
        bottom: expanded ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 'calc(10px + env(safe-area-inset-bottom, 0px))',
        left: '10px',
        zIndex: 99999,
        margin: 0,
        padding: expanded ? '10px 12px' : '6px 10px',
        borderRadius: '12px',
        border: '2px solid #a855f7',
        background: expanded ? 'rgba(88,28,135,0.94)' : 'rgba(124,58,237,0.92)',
        color: '#faf5ff',
        fontSize: expanded ? '11px' : '11px',
        fontWeight: 600,
        lineHeight: 1.35,
        textAlign: 'left',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
        maxWidth: expanded ? 'min(92vw, 320px)' : '88px',
        cursor: 'pointer',
      }}
      aria-label="Restorebraine build info"
    >
      {expanded ? (
        <>
          <div style={{ fontWeight: 700, marginBottom: 4, color: info.wrongOrigin ? '#fca5a5' : undefined }}>
            v{BUILD_NUMBER} · {info.mode}{info.wrongOrigin ? ' · WRONG ORIGIN' : ''}
          </div>
          <div style={{ opacity: 0.9, color: info.wrongOrigin ? '#fca5a5' : undefined }}>{info.origin}</div>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: '10px' }}>{info.nativeStamp}</div>
          <div style={{ opacity: 0.7, marginTop: 2, fontSize: '9px' }}>js: {info.entryScript}</div>
          {typeof window !== 'undefined' && window.__restorebraineOAuthMode ? (
            <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px' }}>
              oauth: {window.__restorebraineOAuthMode}
            </div>
          ) : null}
          <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', color: info.bridgeInstalled ? '#86efac' : '#fca5a5' }}>
            bridge: {info.bridgeInstalled ? (info.bridgeSource || 'index-html') : 'NOT LOADED — rebuild'}
          </div>
          {typeof window !== 'undefined' && window.__restorebraineLastOAuthUrl ? (
            <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', wordBreak: 'break-all' }}>
              oauth: {String(window.__restorebraineLastOAuthUrl).slice(0, 48)}…
            </div>
          ) : null}
          <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', color: info.authLayer === 'none' ? '#fca5a5' : '#86efac' }}>
            auth: {info.authLayer}{info.oldLoginUi ? ' · OLD LOGIN UI' : ''}
          </div>
          {info.htmlStamp ? (
            <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', color: info.stampMismatch ? '#fca5a5' : undefined }}>
              html: {info.htmlStamp.slice(0, 40)}{info.stampMismatch ? ' STALE' : ''}
            </div>
          ) : (
            <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', color: '#fca5a5' }}>html: missing stamp — stale bundle</div>
          )}
          <div style={{ opacity: 0.6, marginTop: 4, fontSize: '9px' }}>tap to minimize</div>
        </>
      ) : (
        <>v{BUILD_NUMBER} ⓘ</>
      )}
    </button>
  );
}
