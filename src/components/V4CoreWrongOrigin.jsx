import { BUILD_NUMBER } from '@/lib/build-info';
import { getV4CoreOriginLabel } from '@/lib/v4-core-guard';

/** Shown when v4-core bundle loaded hosted Base44 instead of capacitor://localhost. */
export default function V4CoreWrongOrigin() {
  const origin = getV4CoreOriginLabel();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg,#fef2f2,#fff7ed,#fefce8)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px 24px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#b91c1c' }}>
          Wrong app mode (v{BUILD_NUMBER})
        </p>
        <h1 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700, color: '#111' }}>
          Hosted login loaded — not build v4
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#444', lineHeight: 1.5 }}>
          This WebView is on <strong>{origin}</strong>, not <code style={{ fontSize: '12px' }}>capacitor://localhost</code>.
          That shows the Base44 hosted login page instead of the v4 card.
        </p>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#666', lineHeight: 1.45, textAlign: 'left' }}>
          On your Mac run:
          <br />
          <code style={{ display: 'block', marginTop: '8px', padding: '10px', background: '#f3f4f6', borderRadius: '8px', fontSize: '11px', wordBreak: 'break-all' }}>
            bash scripts/mac-ios-v4-deploy.sh
          </code>
          Then delete the app from iPhone → Xcode Clean Build Folder → Run.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: '14px',
            border: 'none',
            borderRadius: '12px',
            background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
