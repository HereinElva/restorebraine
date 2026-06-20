import { useState } from 'react';
import { getRestorebraineAppLogo } from '@/lib/app-branding';

/** Bundled brain icon — falls back if AppIcon.png missing from public/. */
export default function LoginLogo() {
  const [failed, setFailed] = useState(false);
  const src = getRestorebraineAppLogo();

  if (failed) {
    return (
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          margin: '0 auto 12px',
          background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 8px 24px rgba(96,165,250,0.25)',
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
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        objectFit: 'cover',
        display: 'block',
        margin: '0 auto 12px',
        boxShadow: '0 8px 24px rgba(96,165,250,0.25)',
      }}
    />
  );
}
