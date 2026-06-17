import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { FeedModeSwitch } from '@/src/components/feed/feed-mode-switch';
import { PostCard, type FeedPost } from '@/src/components/feed/post-card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { useSavedVendors } from '@/src/hooks/use-saved-vendors';
import {
  diagnoseFeedVisibility,
  fetchShopperFeedPosts,
  resolveFeedPosts,
  resolveShopperLocation,
  type ExploreScope,
  type FeedMode,
  type FeedVisibilityIssue,
} from '@/src/lib/shopper-feed';
import { layoutStyles } from '@/src/theme/layout';

function emptyMessage(
  mode: FeedMode,
  exploreScope: ExploreScope,
  hasSaved: boolean,
  hasLocation: boolean,
  issue: FeedVisibilityIssue,
): { title: string; body: string } {
  if (issue === 'not_saved') {
    return {
      title: 'Save this vendor to see their posts',
      body: 'Saved vendors shows posts only from vendors you heart. Switch to Explore → Popular nationwide, or save the vendor on their profile page.',
    };
  }

  if (issue === 'local_mismatch') {
    return {
      title: 'Vendor is outside your area',
      body: 'Near you only shows posts when the vendor\'s city/state matches yours. Try Popular nationwide, or save the vendor for Saved vendors.',
    };
  }

  if (issue === 'explore_policy' || issue === 'rls_empty') {
    if (mode === 'explore') {
      return {
        title: 'Explore feed not available yet',
        body: 'Run phase10_feed_explore.sql in Supabase, and make sure the vendor is approved in Admin.',
      };
    }
  }

  if (mode === 'saved') {
    if (!hasSaved) {
      return {
        title: 'No saved vendors yet',
        body: 'Tap the heart on a vendor\'s page to build your personal feed here.',
      };
    }
    return {
      title: 'No posts yet',
      body: 'Vendors you saved haven\'t posted recently. Try Explore to discover more.',
    };
  }

  if (exploreScope === 'local') {
    if (!hasLocation) {
      return {
        title: 'Add your location',
        body: 'Set your city during onboarding to see vendors near you, or try Popular nationwide.',
      };
    }
    return {
      title: 'Nothing nearby yet',
      body: 'No local vendor posts right now. Try Popular nationwide or save vendors you like.',
    };
  }

  return {
    title: 'No posts to explore',
    body: 'Check back soon as vendors share promotions, launches, and market updates.',
  };
}

export default function ShopperFeedScreen() {
  const { user, shopper } = useAuth();
  const { saved } = useSavedVendors();
  const [allPosts, setAllPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode>('saved');
  const [exploreScope, setExploreScope] = useState<ExploreScope>('popular');

  const location = resolveShopperLocation(user?.city, user?.state, shopper?.default_location);
  const { city, state } = location;
  const hasLocation = Boolean(city || state);
  const hasSaved = saved.length > 0;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        setError(null);
        const result = await fetchShopperFeedPosts();
        if (!active) return;
        if (result.error) {
          setError(result.error);
          setAllPosts([]);
        } else {
          setAllPosts(result.posts);
        }
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, []),
  );

  const posts = useMemo(
    () => resolveFeedPosts(allPosts, mode, exploreScope, saved, location),
    [allPosts, mode, exploreScope, saved, location],
  );

  const visibilityIssue = useMemo(
    () => diagnoseFeedVisibility(allPosts, posts, mode, exploreScope, saved, location),
    [allPosts, posts, mode, exploreScope, saved, location],
  );

  const empty = emptyMessage(mode, exploreScope, hasSaved, hasLocation, visibilityIssue);

  return (
    <Screen scroll={false}>
      <View className="mb-2">
        <Text variant="eyebrow" className="mb-2">
          Stay updated
        </Text>
        <Text variant="title">Feed</Text>
      </View>

      <FeedModeSwitch
        mode={mode}
        onModeChange={setMode}
        exploreScope={exploreScope}
        onExploreScopeChange={setExploreScope}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text variant="subtitle" className="text-center">
            Couldn&apos;t load feed
          </Text>
          <Text variant="caption" className="mt-2 text-center">
            {error.includes('policy') || error.includes('permission')
              ? 'Run docs/supabase/phase10_feed_explore.sql in Supabase to enable Explore.'
              : error}
          </Text>
        </View>
      ) : posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <FontAwesome name="newspaper-o" size={28} color="#9CAF88" />
          <Text variant="subtitle" className="mt-3 text-center">
            {empty.title}
          </Text>
          <Text variant="caption" className="mt-1 text-center">
            {empty.body}
          </Text>
          {mode === 'saved' ? (
            <Pressable className="mt-4 active:opacity-80" onPress={() => setMode('explore')}>
              <Text className="text-base font-medium text-primary">Explore vendors</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={layoutStyles.listContent}
          ListHeaderComponent={
            mode === 'explore' ? (
              <Text variant="caption" className="mb-2">
                {exploreScope === 'local'
                  ? `Showing posts from vendors in ${[city, state].filter(Boolean).join(', ') || 'your area'}.`
                  : 'Showing recent posts from popular vendors across the US.'}
              </Text>
            ) : (
              <Text variant="caption" className="mb-2">
                Posts from vendors you&apos;ve saved.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPressVendor={(vendorId) => router.push(`/(shopper)/vendors/${vendorId}`)}
              onPressProduct={(productId) => router.push(`/(shopper)/products/${productId}`)}
              onPressEvent={(eventId) => router.push(`/(shopper)/events/${eventId}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
