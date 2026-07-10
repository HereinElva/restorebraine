/** Apple logo mark for Sign in with Apple — required by App Store Review (HIG 4.8). */
export default function AppleLogo({ size = 20, className = '' }) {
  return (
    <img
      src="./apple-sign-in-logo.svg"
      alt=""
      aria-hidden="true"
      data-rb-apple-logo="1"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
