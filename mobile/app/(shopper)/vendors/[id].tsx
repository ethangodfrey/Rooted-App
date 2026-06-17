import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  VendorStorefrontView,
  type StorefrontProduct,
} from '@/src/components/vendor/vendor-storefront-view';
import { useSavedVendors } from '@/src/hooks/use-saved-vendors';
import { parseThemeSettings, resolveAccentColor } from '@/src/lib/vendor-storefront';
import { supabase } from '@/src/lib/supabase';
import type { Vendor } from '@/src/types/database';

export default function VendorStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSaved, toggle, pending } = useSavedVendors();
  const saved = isSaved(id);

  const accent = vendor
    ? resolveAccentColor(parseThemeSettings(vendor.theme_settings).accent_color)
    : '#228B22';

  useEffect(() => {
    let active = true;
    async function load() {
      const [vendorRes, productsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('products')
          .select(
            'id, name, description, price, category, reserve_enabled, media_urls, product_event_availability(available_quantity_presale)',
          )
          .eq('vendor_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;
      if (vendorRes.error) {
        setError(vendorRes.error.message);
      } else if (!vendorRes.data) {
        setError('This vendor is not available.');
      } else {
        setVendor(vendorRes.data);
      }
      if (!productsRes.error && productsRes.data) {
        setProducts(productsRes.data as unknown as StorefrontProduct[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Vendor',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
          headerRight: () =>
            vendor ? (
              <Pressable onPress={() => toggle(id)} disabled={pending} hitSlop={8}>
                <FontAwesome
                  name={saved ? 'heart' : 'heart-o'}
                  size={20}
                  color={saved ? '#bc4749' : accent}
                />
              </Pressable>
            ) : null,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : error || !vendor ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'This vendor is not available.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <VendorStorefrontView
            vendor={vendor}
            products={products}
            onPressProduct={(productId) => router.push(`/(shopper)/products/${productId}`)}
          />
        </Screen>
      )}
    </>
  );
}
