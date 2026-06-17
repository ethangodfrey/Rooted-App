import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { formatEventDate, formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';

interface AvailabilityRow {
  available_quantity_presale: number;
  event: {
    id: string;
    name: string;
    start_datetime: string;
    city: string | null;
  } | null;
}

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  media_urls: string[];
  reserve_enabled: boolean;
  prepay_enabled: boolean;
  vendor_id: string;
  vendor: { business_name: string | null } | null;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const [productRes, availRes] = await Promise.all([
        supabase
          .from('products')
          .select(
            'id, name, description, price, category, media_urls, reserve_enabled, prepay_enabled, vendor_id, vendor:vendors(business_name)',
          )
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('product_event_availability')
          .select('available_quantity_presale, event:events(id, name, start_datetime, city)')
          .eq('product_id', id)
          .gt('available_quantity_presale', 0),
      ]);

      if (!active) return;
      if (productRes.error || !productRes.data) {
        setError('This product is not available.');
      } else {
        setProduct(productRes.data as unknown as ProductDetail);
      }
      if (!availRes.error && availRes.data) {
        setAvailability(availRes.data as unknown as AvailabilityRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const reservable = !!product?.reserve_enabled && availability.length > 0;

  function handleBuyNow() {
    Alert.alert(
      'Buy now is coming soon',
      'Online prepayment is on the way. For now, reserve the item and pay the vendor at pickup.',
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Product',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !product ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'Product not found.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          {product.media_urls.length > 0 ? (
            <View className="mb-5">
              <Image
                source={{ uri: product.media_urls[0] }}
                className="h-60 w-full rounded-2xl bg-line"
                resizeMode="cover"
              />
              {product.media_urls.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerClassName="gap-3">
                  {product.media_urls.slice(1).map((url) => (
                    <Image
                      key={url}
                      source={{ uri: url }}
                      className="h-20 w-20 rounded-xl bg-line"
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : (
            <View className="mb-5 h-60 w-full items-center justify-center rounded-2xl bg-forest-100">
              <FontAwesome name="cutlery" size={40} color="#9CAF88" />
            </View>
          )}

          <Text variant="title" className="mb-1">
            {product.name}
          </Text>
          <Text variant="subtitle" className="mb-3">
            {formatPrice(product.price)}
            {product.category ? ` · ${product.category}` : ''}
          </Text>

          <Pressable onPress={() => router.push(`/(shopper)/vendors/${product.vendor_id}`)}>
            <View className="mb-5 flex-row items-center">
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-lg bg-forest-100">
                <FontAwesome name="shopping-bag" size={14} color="#228B22" />
              </View>
              <Text variant="body" className="flex-1 font-semibold text-forest">
                {product.vendor?.business_name ?? 'View vendor'}
              </Text>
              <FontAwesome name="chevron-right" size={13} color="#9CAF88" />
            </View>
          </Pressable>

          {product.description ? (
            <Text variant="body" className="mb-6">
              {product.description}
            </Text>
          ) : null}

          <Text variant="heading" className="mb-3">
            Reserve at
          </Text>
          {availability.length === 0 ? (
            <Text variant="caption" className="mb-6">
              No presale availability right now. Check back, or visit the vendor at an event.
            </Text>
          ) : (
            <View className="mb-6 gap-2">
              {availability.map((row) =>
                row.event ? (
                  <Card key={row.event.id} className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text variant="body" className="font-semibold">
                        {row.event.name}
                      </Text>
                      <Text variant="caption" className="mt-0.5">
                        {formatEventDate(row.event.start_datetime)}
                        {row.event.city ? ` · ${row.event.city}` : ''}
                      </Text>
                    </View>
                    <Text variant="caption" className="text-subtle">
                      {row.available_quantity_presale} left
                    </Text>
                  </Card>
                ) : null,
              )}
            </View>
          )}

          <View className="gap-3">
            <Button
              label="Reserve for pickup"
              disabled={!reservable}
              onPress={() => router.push(`/(shopper)/checkout/reserve?productId=${product.id}`)}
            />
            <Button label="Buy now" variant="secondary" onPress={handleBuyNow} />
            <Text variant="caption" className="text-center">
              Reserve holds your item to pay at pickup. Buy now (online payment) is coming soon.
            </Text>
          </View>
        </Screen>
      )}
    </>
  );
}
