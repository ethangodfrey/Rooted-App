import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { PressableCard } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { layoutStyles } from '@/src/theme/layout';
import type { Product } from '@/src/types/database';

export default function VendorProductsScreen() {
  const { vendor } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendor) return;
    setError(null);
    const { data, error: queryError } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen scroll={false}>
      <View className="mb-4 flex-row items-end justify-between">
        <View>
          <Text variant="eyebrow" className="mb-2">
            Manage
          </Text>
          <Text variant="title">Products</Text>
        </View>
        <Button
          label="+ Add"
          fullWidth={false}
          onPress={() => router.push('/(vendor)/products/new')}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={layoutStyles.listContent}
          ListEmptyComponent={
            <View className="mt-16 items-center">
              <Text variant="subtitle" className="text-center">
                {error
                  ? `Couldn't load products: ${error}`
                  : 'No products yet. Tap "+ Add" to create your first one.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PressableCard
              className="flex-row items-center"
              onPress={() => router.push(`/(vendor)/products/${item.id}/edit`)}>
              {item.media_urls?.length ? (
                <Image
                  source={{ uri: item.media_urls[0] }}
                  className="mr-3 h-14 w-14 rounded-lg bg-line"
                />
              ) : (
                <View className="mr-3 h-14 w-14 items-center justify-center rounded-lg bg-honeydew">
                  <FontAwesome name="cutlery" size={18} color="#9CAF88" />
                </View>
              )}
              <View className="min-w-0 flex-1 pr-2">
                <Text variant="body" className="font-semibold">
                  {item.name}
                </Text>
                <Text variant="caption" className="mt-0.5">
                  {formatPrice(item.price)}
                  {item.category ? ` · ${item.category}` : ''}
                  {item.status === 'archived' ? ' · Archived' : ''}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
            </PressableCard>
          )}
        />
      )}
    </Screen>
  );
}
