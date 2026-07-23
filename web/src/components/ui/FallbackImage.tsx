import { useState, type CSSProperties, type ReactNode } from 'react';

import { categoryVisual } from '@/lib/category-visuals';

export type FallbackImageVariant = 'avatar' | 'vendor-logo' | 'product' | 'banner';

interface FallbackImageProps {
  src?: string | null;
  alt?: string;
  variant?: FallbackImageVariant;
  category?: string | null;
  label?: string;
  className?: string;
  style?: CSSProperties;
  fallbackIcon?: ReactNode;
}

function ProductPlaceholderIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ width: '42%', height: '42%', opacity: 0.55 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function VendorLogoPlaceholderIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ width: '46%', height: '46%', opacity: 0.6 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9.75L12 4l9 5.75M5.25 10.5V19.5A1.5 1.5 0 006.75 21h3.75v-5.25a1.5 1.5 0 011.5-1.5h0a1.5 1.5 0 011.5 1.5V21h3.75a1.5 1.5 0 001.5-1.5v-9"
      />
    </svg>
  );
}

function resolveFallbackContent(
  variant: FallbackImageVariant,
  category: string | null | undefined,
  label: string | undefined,
  fallbackIcon: ReactNode | undefined,
): ReactNode {
  if (fallbackIcon) return fallbackIcon;

  switch (variant) {
    case 'avatar': {
      const initial = (label ?? '?').trim().charAt(0).toUpperCase();
      return initial;
    }
    case 'vendor-logo':
      return <VendorLogoPlaceholderIcon />;
    case 'banner':
      return categoryVisual(category).emoji;
    case 'product':
    default:
      return category ? (
        <span style={{ fontSize: '1.35em', lineHeight: 1 }}>{categoryVisual(category).emoji}</span>
      ) : (
        <ProductPlaceholderIcon />
      );
  }
}

export function FallbackImage({
  src,
  alt = '',
  variant = 'product',
  category,
  label,
  className = '',
  style,
  fallbackIcon,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = src?.trim();
  const showImage = Boolean(normalizedSrc) && !failed;

  if (showImage) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  const fallbackClass = [
    'app-image-fallback',
    `app-image-fallback--${variant}`,
    variant === 'avatar' ? 'profile-avatar profile-avatar--placeholder' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fallbackClass} style={style} aria-hidden={alt ? undefined : true}>
      {resolveFallbackContent(variant, category, label, fallbackIcon)}
    </div>
  );
}
