import { FallbackImage } from './FallbackImage';

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
  const sharedStyle = large
    ? {
        width: '100%',
        maxHeight: 280,
        aspectRatio: '16 / 10' as const,
        borderRadius: 16,
        marginBottom: '1rem',
      }
    : {
        width: size,
        height: size,
        borderRadius: size >= 56 ? 12 : 8,
      };

  return (
    <FallbackImage
      src={src}
      variant="product"
      category={category}
      className={className}
      style={{
        ...sharedStyle,
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
}
