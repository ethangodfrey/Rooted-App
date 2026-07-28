import { categoryVisual } from '@/lib/category-visuals';

import { FallbackImage } from '@/components/ui/FallbackImage';

interface DiscoverThumbProps {
  imageUrl?: string | null;
  category?: string | null;
  size?: number;
}

export function DiscoverThumb({ imageUrl, category, size = 56 }: DiscoverThumbProps) {
  const visual = categoryVisual(category);

  return (
    <FallbackImage
      src={imageUrl}
      variant="product"
      category={category}
      fallbackIcon={<span className="app-thumb-fallback__icon">{visual.emoji}</span>}
      className="app-thumb-fallback app-row-icon"
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
        fontSize: size * 0.4,
      }}
    />
  );
}
