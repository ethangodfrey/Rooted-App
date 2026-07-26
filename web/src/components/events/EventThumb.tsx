import { FallbackImage } from '@/components/ui/FallbackImage';
import { resolveEventBannerUrl, type EventImageFields } from '@/lib/event-image';

interface EventThumbProps {
  event: EventImageFields;
  size?: number;
  large?: boolean;
}

export function EventThumb({ event, size = 56, large = false }: EventThumbProps) {
  const imageUrl = resolveEventBannerUrl(event);
  const sharedStyle = large
    ? {
        width: '100%',
        height: 200,
        borderRadius: 16,
        objectFit: 'cover' as const,
        flexShrink: 0,
        marginBottom: '1rem',
      }
    : {
        width: size,
        height: size,
        borderRadius: 12,
        objectFit: 'cover' as const,
        flexShrink: 0,
      };

  return (
    <FallbackImage
      src={imageUrl}
      alt=""
      variant="banner"
      category={event.market_type}
      style={sharedStyle}
    />
  );
}
