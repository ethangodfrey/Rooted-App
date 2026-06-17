import { Stack, useFocusEffect } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  VendorStorefrontView,
  type StorefrontProduct,
} from '@/src/components/vendor/vendor-storefront-view';
import { useAuth } from '@/src/hooks/use-auth';
import { supabase } from '@/src/lib/supabase';
import type { Vendor } from '@/src/types/database';

export default function VendorStorefrontPreviewScreen() {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        if (!user) {
          setLoading(false);
          return;
        }

        setLoading(true);

        const { data: vendorRow } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (!vendorRow) {
          setVendor(null);
          setProducts([]);
          setLoading(false);
          return;
        }

        setVendor(vendorRow);

        const { data } = await supabase
          .from('products')
          .select(
            'id, name, description, price, category, reserve_enabled, media_urls, product_event_availability(available_quantity_presale)',
          )
          .eq('vendor_id', vendorRow.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!active) return;
        setProducts((data as unknown as StorefrontProduct[]) ?? []);
        setLoading(false);
      }

      load();
      return () => {
        active = false;
      };
    }, [user]),
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Shop preview',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !vendor ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            Vendor profile not found.
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <VendorStorefrontView vendor={vendor} products={products} previewMode />
        </Screen>
      )}
    </>
  );
}
