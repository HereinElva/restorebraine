import { useId } from 'react';

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

/** Gradient Lucide icon — embeds its own SVG defs so it works in Base44 without Layout. */
export function BrandGradientIcon({ Icon, className, ...props }) {
  const gradId = useId().replace(/:/g, '');
  return (
    <span className="inline-flex items-center justify-center leading-none">
      <svg aria-hidden="true" focusable="false" className="absolute w-0 h-0 overflow-hidden pointer-events-none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <Icon className={className} stroke={`url(#${gradId})`} fill="none" {...props} />
    </span>
  );
}
