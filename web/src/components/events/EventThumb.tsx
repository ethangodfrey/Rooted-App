import { FallbackImage } from '@/components/ui/FallbackImage';
import {
  eventPlaceholderEmoji,
  resolveEventBannerUrl,
  type EventImageFields,
} from '@/lib/event-image';

interface EventThumbProps {
  event: EventImageFields;
  size?: number;
  large?: boolean;
}

export function EventThumb({ event, size = 56, large = false }: EventThumbProps) {
  const imageUrl = resolveEventBannerUrl(event);
  const dimensions = large
    ? {
        width: '100%' as const,
        height: 200,
        borderRadius: 16,
        marginBottom: '1rem' as const,
      }
    : {
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
      };

  return (
    <FallbackImage
      src={imageUrl}
      variant="banner"
      category={event.market_type}
      fallbackIcon={eventPlaceholderEmoji(event.market_type)}
      className={large ? 'app-event-card-thumb' : ''}
      style={{
        ...dimensions,
        objectFit: 'cover',
        ...(large ? {} : { flexShrink: 0 }),
        ...(imageUrl ? {} : { background: '#18181b', color: '#a1a1aa' }),
      }}
    />
  );
}
