import AppleLogo from '@/components/AppleLogo';

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
  return (
    <button
      type="button"
      data-rb-provider="apple"
      className="rb-signin-apple"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={loading ? loadingLabel : label}
    >
      <span className="rb-signin-apple-inner">
        <AppleLogo size={18} />
        <span className="rb-signin-apple-label">{loading ? loadingLabel : label}</span>
      </span>
    </button>
  );
}
