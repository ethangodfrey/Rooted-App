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
      alt=""
      variant="product"
      category={category}
      className="object-cover"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
      }}
    />
  );
}
