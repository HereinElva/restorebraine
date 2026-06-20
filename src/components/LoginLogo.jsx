import { useMemo, useState } from 'react';
import { getRestorebraineAppLogo, getRestorebraineAppLogoFallbacks } from '@/lib/app-branding';

/** Build v4: bundled login-logo.png — brain emoji only if all bundled paths fail. */
export default function LoginLogo({ compact = false }) {
  const sources = useMemo(() => getRestorebraineAppLogoFallbacks(), []);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex] ?? getRestorebraineAppLogo();
  const size = compact ? 44 : 56;
  const radius = compact ? 12 : 16;
  const failed = sourceIndex >= sources.length;

  if (failed) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${radius}px`,
          margin: compact ? 0 : '0 auto 12px',
          background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '22px' : '28px',
          boxShadow: '0 6px 20px rgba(96,165,250,0.22)',
        }}
        aria-hidden
      >
        🧠
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Restorebraine"
      data-rb-logo="1"
      onError={() => setSourceIndex((index) => index + 1)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${radius}px`,
        objectFit: 'cover',
        display: 'block',
        margin: compact ? 0 : '0 auto 12px',
        boxShadow: '0 6px 20px rgba(96,165,250,0.22)',
      }}
    />
  );
}
