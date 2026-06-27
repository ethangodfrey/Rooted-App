import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

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
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Deduped tags across the loaded posts, in first-seen order.
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

  return (
    <Screen>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <Text variant="title" className="mb-4">
              Explore local food
            </Text>
            {tags.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                <Chip
                  label="All"
                  selected={selectedTag === null}
                  onPress={() => setSelectedTag(null)}
                />
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
        }
        ListEmptyComponent={
          loading ? (
            <LoadingIndicator />
          ) : (
            <Text variant="caption">Showcase content from vendors and chefs will appear here.</Text>
          )
        }
        renderItem={({ item }) => {
          const href = resolveExploreContentHref(item);
          return (
            <ExplorePost
              item={item}
              creatorName={item.creatorName}
              creatorAvatarUrl={item.creatorAvatarUrl}
              onPress={href ? () => router.push(href as never) : undefined}
            />
          );
        }}
      />
    </Screen>
  );
}
