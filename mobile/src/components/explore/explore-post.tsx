import { memo } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { EXPLORE_CONTENT_TYPE_LABEL } from '@/src/lib/explore-content';
import type { ExploreContent } from '@/src/types/database';

interface ExplorePostProps {
  item: ExploreContent;
  creatorName?: string | null;
  creatorAvatarUrl?: string | null;
  onPress?: () => void;
}

export const ExplorePost = memo(function ExplorePost({
  item,
  creatorName,
  creatorAvatarUrl,
  onPress,
}: ExplorePostProps) {
  const { width } = useWindowDimensions();
  const imageWidth = width - 32;
  const images = item.media_urls ?? [];
  const typeLabel = EXPLORE_CONTENT_TYPE_LABEL[item.content_type] ?? item.content_type;
  const creatorInitial = creatorName?.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 overflow-hidden rounded-2xl bg-white">
      {images.length > 1 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          className="h-48 w-full">
          {images.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={{ width: imageWidth, height: 192 }}
              resizeMode="cover"
              fadeDuration={200}
            />
          ))}
        </ScrollView>
      ) : images.length === 1 ? (
        <Image
          source={{ uri: images[0] }}
          className="h-48 w-full"
          resizeMode="cover"
          fadeDuration={200}
        />
      ) : (
        <View className="h-48 w-full items-center justify-center bg-cream">
          <Text variant="caption">{typeLabel}</Text>
        </View>
      )}
      <View className="p-3">
        {creatorName ? (
          <View className="mb-2 flex-row items-center gap-2">
            {creatorAvatarUrl ? (
              <Image
                source={{ uri: creatorAvatarUrl }}
                className="h-7 w-7 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-7 w-7 items-center justify-center rounded-full bg-honeydew">
                <Text variant="caption" className="text-primary">
                  {creatorInitial}
                </Text>
              </View>
            )}
            <Text variant="caption" className="font-semibold" numberOfLines={1}>
              {creatorName}
            </Text>
          </View>
        ) : null}
        <View className="mb-1 flex-row items-center justify-between">
          <Text variant="caption" className="text-primary">
            {typeLabel}
          </Text>
          {images.length > 1 ? (
            <Text variant="caption">{images.length} photos</Text>
          ) : null}
        </View>
        {item.title ? <Text variant="heading">{item.title}</Text> : null}
        {item.caption ? (
          <Text variant="body" numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
