import { useState } from 'react';
import { getRestorebraineAppLogo } from '@/lib/app-branding';

/** Build v4: bundled AppIcon.png — brain emoji only if image missing. */
export default function LoginLogo({ compact = false }) {
  const [failed, setFailed] = useState(false);
  const src = getRestorebraineAppLogo();
  const size = compact ? 44 : 56;
  const radius = compact ? 12 : 16;

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
      onError={() => setFailed(true)}
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
