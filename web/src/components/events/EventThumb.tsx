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
  const dimensionStyle = {
    width: large ? '100%' : size,
    height: large ? 200 : size,
    borderRadius: large ? 16 : 12,
    flexShrink: 0,
    marginBottom: large ? '1rem' : 0,
  } as const;

  return (
    <FallbackImage
      src={imageUrl}
      alt=""
      variant="banner"
      className={large ? 'object-cover' : 'object-cover'}
      style={dimensionStyle}
      fallbackIcon={
        <span style={{ fontSize: large ? '2.5rem' : '1.35rem', lineHeight: 1 }}>
          {eventPlaceholderEmoji(event.market_type)}
        </span>
      }
    />
  );
}
