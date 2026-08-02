import React from 'react';

export default class BootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Restorebraine render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: 'linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8)',
        }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              Restorebraine hit a display error
            </h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              {this.state.error?.message || 'Something went wrong while loading the app.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: 12,
                background: '#7c3aed',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
