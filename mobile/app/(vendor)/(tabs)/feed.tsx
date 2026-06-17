import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { PostCard, type FeedPost } from '@/src/components/feed/post-card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import { layoutStyles } from '@/src/theme/layout';

type FeedSection = 'posts' | 'videos';

const POST_SELECT =
  'id, vendor_id, post_type, caption, media_url, media_type, video_thumbnail_url, publish_at, created_at, vendor:vendors(id, business_name), product:products(id, name), event:events(id, name)';

export default function VendorFeedScreen() {
  const { vendor } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [section, setSection] = useState<FeedSection>('posts');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!vendor) {
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .eq('vendor_id', vendor.id)
          .order('publish_at', { ascending: false });
        if (!active) return;
        setPosts((data as unknown as FeedPost[]) ?? []);
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [vendor]),
  );

  const filtered = useMemo(
    () =>
      posts.filter((post) =>
        section === 'videos' ? post.media_type === 'video' : post.media_type !== 'video',
      ),
    [posts, section],
  );

  return (
    <Screen scroll={false}>
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text variant="eyebrow" className="mb-2">
            Broadcast
          </Text>
          <Text variant="title">Feed</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push('/(vendor)/posts/new-video')}
            className="h-11 w-11 items-center justify-center rounded-full bg-forest-100"
            accessibilityLabel="New video post">
            <FontAwesome name="video-camera" size={16} color="#228B22" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(vendor)/posts/new')}
            className="h-11 w-11 items-center justify-center rounded-full bg-forest"
            accessibilityLabel="New post">
            <FontAwesome name="plus" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <View className="mb-4 flex-row gap-2">
        <Chip
          label="Posts"
          selected={section === 'posts'}
          onPress={() => setSection('posts')}
        />
        <Chip
          label="Videos"
          selected={section === 'videos'}
          onPress={() => setSection('videos')}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <FontAwesome
            name={section === 'videos' ? 'video-camera' : 'bullhorn'}
            size={28}
            color="#9CAF88"
          />
          <Text variant="caption" className="mt-3 text-center">
            {section === 'videos'
              ? 'No videos yet. Tap the video button to share a clip with your followers.'
              : 'No posts yet. Tap + to share a promotion, launch, restock, or update with your followers.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={layoutStyles.listContent}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(vendor)/posts/${item.id}/edit`)}>
              <PostCard post={item} showVendor={false} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
