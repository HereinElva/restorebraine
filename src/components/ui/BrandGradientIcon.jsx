/** Shared blue→purple brand gradient (matches search bar / "Memories" title). */
export const BRAND_GRADIENT_TEXT_CLASS =
  'bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent';

export function BrandGradientDefs() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute w-0 h-0 overflow-hidden pointer-events-none">
      <defs>
        <linearGradient id="rb-brand-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BrandGradientIcon({ Icon, className, ...props }) {
  return <Icon className={className} stroke="url(#rb-brand-gradient)" {...props} />;
}
