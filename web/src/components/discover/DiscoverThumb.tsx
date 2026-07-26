import { FallbackImage } from '@/components/ui/FallbackImage';

interface DiscoverThumbProps {
  imageUrl?: string | null;
  category?: string | null;
  size?: number;
}

export function DiscoverThumb({ imageUrl, category, size = 56 }: DiscoverThumbProps) {
  return (
    <FallbackImage
      src={imageUrl}
      variant="product"
      category={category}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
}
