import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, RefreshControl, ScrollView, View } from 'react-native';

import { ExplorePost } from '@/src/components/explore/explore-post';
import { Chip } from '@/src/components/ui/chip';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  fetchExploreFeed,
  resolveExploreContentHref,
  type ExploreFeedItem,
} from '@/src/lib/explore-content';
import { colors } from '@/src/theme/colors';

const ESTIMATED_ITEM_HEIGHT = 280;

const ExploreListItem = memo(function ExploreListItem({ item }: { item: ExploreFeedItem }) {
  const href = resolveExploreContentHref(item);
  return (
    <ExplorePost
      item={item}
      creatorName={item.creatorName}
      creatorAvatarUrl={item.creatorAvatarUrl}
      onPress={href ? () => router.push(href as never) : undefined}
    />
  );
});

export default function ExploreScreen() {
  const [items, setItems] = useState<ExploreFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    const feed = await fetchExploreFeed(50);
    setItems(feed);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void load().then(() => {
        if (cancelled) setLoading(false);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const tags = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        const trimmed = tag.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          ordered.push(trimmed);
        }
      }
    }
    return ordered;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!selectedTag) return items;
    return items.filter((item) => (item.tags ?? []).includes(selectedTag));
  }, [items, selectedTag]);

  const renderItem = useCallback(
    ({ item }: { item: ExploreFeedItem }) => <ExploreListItem item={item} />,
    [],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <Text variant="title" className="mb-4">
          Explore local food
        </Text>
        {tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            <Chip label="All" selected={selectedTag === null} onPress={() => setSelectedTag(null)} />
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={selectedTag === tag}
                onPress={() => setSelectedTag(tag)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    ),
    [selectedTag, tags],
  );

  const listEmpty = useMemo(
    () =>
      loading ? (
        <LoadingIndicator />
      ) : (
        <View className="items-center rounded-bento bg-warm-sage px-6 py-10">
          <Text className="text-3xl">🌿</Text>
          <Text variant="subtitle" className="mt-3 text-center font-semibold">
            Nothing to explore yet
          </Text>
          <Text variant="caption" className="mt-2 text-center" style={{ opacity: 0.8 }}>
            Showcase content from vendors and chefs will appear here.
          </Text>
        </View>
      ),
    [loading],
  );

  return (
    <Screen>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={5}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}
