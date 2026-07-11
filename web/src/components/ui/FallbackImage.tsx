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
      return '🏪';
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
