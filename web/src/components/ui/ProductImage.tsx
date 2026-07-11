import { categoryVisual } from '@/lib/category-visuals';

import { SafeImage } from './SafeImage';

interface ProductImageProps {
  src?: string | null;
  category?: string | null;
  name?: string | null;
  size?: number | 'full';
  rounded?: 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

export function ProductImage({
  src,
  category,
  name,
  size = 48,
  rounded = 'md',
  className = '',
  style,
}: ProductImageProps) {
  const visual = categoryVisual(category);
  const isFull = size === 'full';
  const sizeStyle = isFull
    ? { width: '100%' as const, height: undefined, ...style }
    : { width: size, height: size, ...style };
  const roundedClass = `app-product-image--${rounded}`;

  return (
    <SafeImage
      src={src ?? undefined}
      alt={name ? `${name} photo` : ''}
      className={`app-product-image ${roundedClass} ${className}`.trim()}
      style={{
        ...sizeStyle,
        ...(isFull ? { maxHeight: 280, objectFit: 'cover' as const } : {}),
      }}
      fallback={
        <div
          className={`app-product-image app-product-image--fallback ${roundedClass}`}
          style={sizeStyle}
          aria-hidden="true"
        >
          <span className="app-product-image__glyph">{visual.emoji}</span>
        </div>
      }
    />
  );
}
