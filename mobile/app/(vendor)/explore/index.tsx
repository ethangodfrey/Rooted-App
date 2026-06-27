import { FontAwesome } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import {
  EXPLORE_CONTENT_TYPE_LABEL,
  deleteExploreContent,
  fetchExploreContentForCreator,
} from '@/src/lib/explore-content';
import type { ExploreContent } from '@/src/types/database';

const DANGER = '#DC2626';

export default function VendorExploreScreen() {
  const { vendor } = useAuth();
  const [items, setItems] = useState<ExploreContent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await fetchExploreContentForCreator({
      creatorType: 'vendor',
      vendorId: vendor.id,
    });
    setItems(data);
    setLoading(false);
  }, [vendor?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmDelete(item: ExploreContent) {
    Alert.alert('Delete post', 'Remove this showcase post from Explore?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((current) => current.filter((row) => row.id !== item.id));
          try {
            await deleteExploreContent(item.id);
          } catch {
            void load();
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Explore showcase',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="subtitle" className="mb-4">
          Share photos of your products, behind-the-scenes moments, and promotions in the customer
          Explore feed.
        </Text>

        <Button
          className="mb-6"
          label="New showcase post"
          onPress={() => router.push('/(vendor)/explore/new')}
        />

        {loading ? (
          <LoadingIndicator />
        ) : items.length === 0 ? (
          <Text variant="caption">
            You haven&apos;t posted anything yet. Tap &ldquo;New showcase post&rdquo; to get started.
          </Text>
        ) : (
          <View className="gap-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden p-0">
                {item.media_urls.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {item.media_urls.map((url) => (
                      <Image key={url} source={{ uri: url }} className="h-40 w-40" />
                    ))}
                  </ScrollView>
                ) : null}
                <View className="flex-row items-start justify-between p-3.5">
                  <View className="min-w-0 flex-1 pr-3">
                    <Text variant="caption" className="mb-0.5 text-primary">
                      {EXPLORE_CONTENT_TYPE_LABEL[item.content_type]}
                    </Text>
                    {item.title ? (
                      <Text variant="body" className="font-semibold">
                        {item.title}
                      </Text>
                    ) : null}
                    {item.caption ? (
                      <Text variant="caption" className="mt-0.5" numberOfLines={2}>
                        {item.caption}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => confirmDelete(item)}
                    hitSlop={8}
                    accessibilityLabel="Delete post">
                    <FontAwesome name="trash-o" size={18} color={DANGER} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}
