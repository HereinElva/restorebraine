import AppleLogo from '@/components/AppleLogo';

const APPLE_BUTTON_STYLE = {
  width: '100%',
  minHeight: '44px',
  padding: '0 16px',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  background: '#000000',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'rgba(255,255,255,0.1)',
  touchAction: 'manipulation',
  boxSizing: 'border-box',
};

/**
 * Sign in with Apple — black button, Apple logo, HIG-compliant label.
 * https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
 */
export default function SignInWithAppleButton({
  onClick,
  disabled = false,
  loading = false,
  label = 'Sign in with Apple',
  loadingLabel = 'Opening Apple…',
}) {
  const text = loading ? loadingLabel : label;

  return (
    <button
      type="button"
      data-rb-provider="apple"
      data-rb-apple-sign-in="true"
      className="rb-signin-apple"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={text}
      style={{
        ...APPLE_BUTTON_STYLE,
        opacity: disabled || loading ? 0.7 : 1,
        cursor: disabled || loading ? 'wait' : 'pointer',
      }}
    >
      <AppleLogo size={20} />
      <span style={{ color: '#ffffff', lineHeight: 1.2 }}>{text}</span>
    </button>
  );
}
