import { FontAwesome } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { PostMedia } from '@/src/components/feed/post-media';
import { Card } from '@/src/components/ui/card';
import { Text } from '@/src/components/ui/text';
import { formatDateTime, formatRelativeTime } from '@/src/lib/format';
import { POST_TYPE_ICON, POST_TYPE_LABEL } from '@/src/lib/post-type';
import type { PostMediaType, PostType } from '@/src/types/database';

export interface FeedPost {
  id: string;
  vendor_id: string;
  post_type: PostType;
  caption: string;
  media_url: string | null;
  media_type?: PostMediaType | null;
  video_thumbnail_url?: string | null;
  publish_at: string;
  created_at: string;
  vendor: {
    id: string;
    business_name: string | null;
    sell_city?: string | null;
    sell_state?: string | null;
  } | null;
  product: { id: string; name: string } | null;
  event: { id: string; name: string } | null;
}

interface PostCardProps {
  post: FeedPost;
  showVendor?: boolean;
  onPressVendor?: (vendorId: string) => void;
  onPressProduct?: (productId: string) => void;
  onPressEvent?: (eventId: string) => void;
}

export function PostCard({
  post,
  showVendor = true,
  onPressVendor,
  onPressProduct,
  onPressEvent,
}: PostCardProps) {
  const scheduled = new Date(post.publish_at).getTime() > Date.now();
  return (
    <Card
      className="border-l-4 border-harvest pl-4"
      style={{ borderLeftColor: '#D4A853', borderLeftWidth: 4 }}>
      <View className="mb-2 flex-row items-center">
        <View className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-honeydew">
          <FontAwesome name={POST_TYPE_ICON[post.post_type]} size={15} color="#C4704B" />
        </View>
        <View className="flex-1">
          {showVendor && post.vendor ? (
            <Pressable
              disabled={!onPressVendor}
              onPress={() => onPressVendor?.(post.vendor!.id)}>
              <Text variant="body" className="font-semibold">
                {post.vendor.business_name ?? 'Vendor'}
              </Text>
            </Pressable>
          ) : null}
          <Text variant="caption">
            {POST_TYPE_LABEL[post.post_type]} ·{' '}
            {scheduled ? 'scheduled' : formatRelativeTime(post.publish_at)}
          </Text>
        </View>
        {scheduled ? (
          <View className="flex-row items-center rounded-full bg-forest-50 px-2.5 py-1">
            <FontAwesome name="clock-o" size={11} color="#b45309" />
            <Text className="ml-1 text-xs font-semibold text-warn">
              {formatDateTime(post.publish_at)}
            </Text>
          </View>
        ) : null}
      </View>

      <Text variant="body" className="mb-1">
        {post.caption}
      </Text>

      {post.media_url ? (
        <PostMedia
          mediaUrl={post.media_url}
          mediaType={post.media_type}
          videoThumbnailUrl={post.video_thumbnail_url}
        />
      ) : null}

      {post.product || post.event ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {post.product ? (
            <Pressable
              disabled={!onPressProduct}
              onPress={() => onPressProduct?.(post.product!.id)}
              className="flex-row items-center rounded-full bg-forest-50 px-3 py-1.5">
              <FontAwesome name="cutlery" size={12} color="#228B22" />
              <Text className="ml-1.5 text-xs font-semibold text-forest">{post.product.name}</Text>
            </Pressable>
          ) : null}
          {post.event ? (
            <Pressable
              disabled={!onPressEvent}
              onPress={() => onPressEvent?.(post.event!.id)}
              className="flex-row items-center rounded-full bg-forest-50 px-3 py-1.5">
              <FontAwesome name="calendar" size={12} color="#228B22" />
              <Text className="ml-1.5 text-xs font-semibold text-forest">{post.event.name}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
