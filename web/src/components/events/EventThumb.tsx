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
  const width = large ? '100%' : size;
  const height = large ? 200 : size;
  const borderRadius = large ? 16 : 12;

  return (
    <FallbackImage
      src={imageUrl}
      variant="banner"
      alt=""
      fallbackIcon={
        <span style={{ fontSize: large ? '2rem' : '1.15rem', lineHeight: 1 }}>
          {eventPlaceholderEmoji(event.market_type)}
        </span>
      }
      className="shrink-0 object-cover"
      style={{
        width,
        height,
        borderRadius,
        flexShrink: 0,
        marginBottom: large ? '1rem' : 0,
        minWidth: large ? undefined : size,
        minHeight: large ? undefined : size,
      }}
    />
  );
}
