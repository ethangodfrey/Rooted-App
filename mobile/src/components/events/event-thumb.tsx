import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import {
  eventPlaceholderEmoji,
  resolveEventBannerUrl,
  type EventImageFields,
} from '@/src/lib/event-image';

interface EventThumbProps {
  event: EventImageFields;
  size?: 'sm' | 'md' | 'lg';
}

export function EventThumb({ event, size = 'sm' }: EventThumbProps) {
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveEventBannerUrl(event);
  const dim =
    size === 'lg' ? 'h-40 w-full' : size === 'md' ? 'h-16 w-16' : 'h-14 w-14';
  const emojiSize = size === 'lg' ? 40 : size === 'md' ? 24 : 22;

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`${dim} rounded-xl bg-line`}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  if (size === 'lg') {
    return (
      <View className={`${dim} items-center justify-center rounded-2xl bg-honeydew`}>
        <Text style={{ fontSize: emojiSize }}>{eventPlaceholderEmoji(event.market_type)}</Text>
      </View>
    );
  }

  return (
    <View className={`${dim} items-center justify-center rounded-xl bg-honeydew`}>
      <Text style={{ fontSize: emojiSize }}>{eventPlaceholderEmoji(event.market_type)}</Text>
    </View>
  );
}
