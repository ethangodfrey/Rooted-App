import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { categoryVisual } from '@/src/lib/category-visuals';

interface DiscoverThumbProps {
  imageUrl?: string | null;
  category?: string | null;
  size?: 'sm' | 'md';
}

export function DiscoverThumb({ imageUrl, category, size = 'sm' }: DiscoverThumbProps) {
  const [failed, setFailed] = useState(false);
  const visual = categoryVisual(category);
  const dim = size === 'sm' ? 'h-14 w-14' : 'h-16 w-16';
  const emojiSize = size === 'sm' ? 22 : 24;

  if (imageUrl && !failed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`${dim} rounded-xl bg-line`}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View className={`${dim} items-center justify-center rounded-xl bg-honeydew`}>
      <Text style={{ fontSize: emojiSize }}>{visual.emoji}</Text>
    </View>
  );
}
