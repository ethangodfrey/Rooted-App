import { FallbackImage } from '@/components/ui/FallbackImage';
import { resolveMarketHeroUrl, type MarketImageFields } from '@/lib/market-image';

interface MarketHeroImageProps {
  event: MarketImageFields;
  className?: string;
}

export function MarketHeroImage({ event, className = '' }: MarketHeroImageProps) {
  const src = resolveMarketHeroUrl(event);

  return (
    <FallbackImage
      src={src}
      alt=""
      variant="banner"
      category={event.market_type}
      className={`h-48 w-full rounded-2xl object-cover shadow-sm md:h-56 lg:h-64 ${className}`.trim()}
      style={{
        background: 'linear-gradient(135deg, #1a3d2e 0%, #2d5a3d 50%, #4a7c59 100%)',
      }}
    />
  );
}
