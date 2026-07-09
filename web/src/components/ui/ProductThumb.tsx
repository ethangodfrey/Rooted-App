import { useState } from 'react';

import { categoryVisual } from '@/lib/category-visuals';

interface ProductThumbProps {
  src?: string | null;
  category?: string | null;
  size?: number;
  large?: boolean;
  className?: string;
}

export function ProductThumb({
  src,
  category,
  size = 48,
  large = false,
  className = '',
}: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  const visual = categoryVisual(category);

  const sharedStyle = large
    ? {
        width: '100%',
        maxHeight: 280,
        aspectRatio: '16 / 10',
        borderRadius: 16,
        marginBottom: '1rem',
      }
    : {
        width: size,
        height: size,
        borderRadius: size >= 56 ? 12 : 8,
      };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={className}
        onError={() => setFailed(true)}
        style={{
          ...sharedStyle,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--color-line, #e8e8e8)',
        }}
      />
    );
  }

  return (
    <div
      className={`app-thumb-fallback ${className}`.trim()}
      style={{
        ...sharedStyle,
        fontSize: large ? '3rem' : size * 0.42,
      }}
      aria-hidden="true"
    >
      <span className="app-thumb-fallback__icon">{visual.emoji}</span>
    </div>
  );
}
