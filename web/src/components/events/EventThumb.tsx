import {
  eventPlaceholderEmoji,
  resolveEventBannerUrl,
  type EventImageFields,
} from '@/lib/event-image';
import { FallbackImage } from '@/components/ui/FallbackImage';

interface EventThumbProps {
  event: EventImageFields;
  size?: number;
  large?: boolean;
}

export function EventThumb({ event, size = 56, large = false }: EventThumbProps) {
  const imageUrl = resolveEventBannerUrl(event);
  const width = large ? '100%' : size;
  const height = large ? 200 : size;
  const borderRadius = large ? 16 : 12;

  return (
    <FallbackImage
      src={imageUrl}
      variant="banner"
      category={event.market_type}
      fallbackIcon={
        <span style={{ fontSize: large ? '2rem' : '1.25rem', lineHeight: 1 }}>
          {eventPlaceholderEmoji(event.market_type)}
        </span>
      }
      className="app-event-card-thumb"
      style={{
        width,
        height,
        borderRadius,
        objectFit: 'cover',
        flexShrink: 0,
        marginBottom: large ? '1rem' : 0,
      }}
    />
  );
}
