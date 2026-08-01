import React, { useState } from 'react';

/**
 * Pre-v87 signed-out screen (before 5762b16 SignedOutLanding).
 * Full-screen centered card — no gallery header, no bottom nav, no "Find Your Memories" shell.
 */
export default function ClassicLoginLanding({ onSignIn }) {
  const [opening, setOpening] = useState(false);

  const handleSignIn = () => {
    setOpening(true);
    onSignIn();
    window.setTimeout(() => setOpening(false), 10000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg,#93c5fd,#a78bfa)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <span style={{ fontSize: '28px' }}>🔍</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111', marginBottom: '8px' }}>
          Restorebraine
        </h1>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '14px' }}>
          Sign in to access your memories
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={opening}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg,#60a5fa,#a78bfa)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: opening ? 'wait' : 'pointer',
            opacity: opening ? 0.85 : 1,
          }}
        >
          {opening ? 'Opening sign in…' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}
