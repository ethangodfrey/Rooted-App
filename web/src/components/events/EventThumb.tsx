import { useState } from 'react';

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
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveEventBannerUrl(event);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{
          width: large ? '100%' : size,
          height: large ? 200 : size,
          borderRadius: large ? 16 : 12,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--color-line, #e8e8e8)',
          marginBottom: large ? '1rem' : 0,
        }}
      />
    );
  }

  return (
    <div
      className="app-row-icon"
      style={{
        width: large ? '100%' : size,
        height: large ? 200 : size,
        borderRadius: large ? 16 : 12,
        flexShrink: 0,
        fontSize: large ? 48 : size * 0.4,
        marginBottom: large ? '1rem' : 0,
      }}
    >
      {eventPlaceholderEmoji(event.market_type)}
    </div>
  );
}
