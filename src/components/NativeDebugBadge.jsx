import { useMemo, useState } from 'react';
import { BUILD_NUMBER, NATIVE_BUILD_LABEL } from '@/lib/build-info';
import { LOCAL_NATIVE_BUNDLE } from '@/lib/native-bundle-mode';
import { isHostedAppOrigin, isNativeShell } from '@/lib/native-hosted-redirect';

const getModeLabel = () => {
  if (!isNativeShell()) return 'web';
  if (isHostedAppOrigin()) return 'native-hosted';
  if (LOCAL_NATIVE_BUNDLE) return 'v4-core';
  return 'native';
};

export default function NativeDebugBadge() {
  const [expanded, setExpanded] = useState(true);

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
    const stampMismatch = htmlStamp && !htmlStamp.includes(`v${BUILD_NUMBER}`);
    return {
      mode: getModeLabel(),
      origin,
      nativeStamp: nativeStamp || NATIVE_BUILD_LABEL,
      entryScript,
      htmlStamp,
      stampMismatch,
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
        bottom: expanded ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 'calc(8px + env(safe-area-inset-bottom, 0px))',
        left: '8px',
        zIndex: 99999,
        margin: 0,
        padding: expanded ? '8px 10px' : '4px 8px',
        borderRadius: '10px',
        border: '1px solid rgba(147,51,234,0.35)',
        background: 'rgba(17,24,39,0.88)',
        color: '#f3e8ff',
        fontSize: expanded ? '11px' : '10px',
        lineHeight: 1.35,
        textAlign: 'left',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        maxWidth: expanded ? 'min(92vw, 320px)' : '72px',
        cursor: 'pointer',
      }}
      aria-label="Restorebraine build info"
    >
      {expanded ? (
        <>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>v{BUILD_NUMBER} · {info.mode}</div>
          <div style={{ opacity: 0.9 }}>{info.origin}</div>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: '10px' }}>{info.nativeStamp}</div>
          <div style={{ opacity: 0.7, marginTop: 2, fontSize: '9px' }}>js: {info.entryScript}</div>
          {typeof window !== 'undefined' && window.__restorebraineLastOAuthUrl ? (
            <div style={{ opacity: 0.65, marginTop: 2, fontSize: '9px', wordBreak: 'break-all' }}>
              oauth: {String(window.__restorebraineLastOAuthUrl).slice(0, 48)}…
            </div>
          ) : null}
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
        `v${BUILD_NUMBER}`
      )}
    </button>
  );
}
