import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { layoutStyles } from '@/src/theme/layout';
import type { OrderStatus } from '@/src/types/database';

interface OrderRow {
  id: string;
  order_status: OrderStatus;
  total: number;
  created_at: string;
  vendor: { business_name: string | null } | null;
  event: { name: string } | null;
}

export default function ShopperOrdersTabScreen() {
  const { shopper } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!shopper) {
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('orders')
          .select(
            'id, order_status, total, created_at, vendor:vendors(business_name), event:events(name)',
          )
          .eq('shopper_id', shopper.id)
          .order('created_at', { ascending: false });
        if (!active) return;
        setOrders((data as unknown as OrderRow[]) ?? []);
        setLoading(false);
      }
      void load();
      return () => {
        active = false;
      };
    }, [shopper]),
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <LoadingIndicator />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <Screen centered>
        <FontAwesome name="shopping-basket" size={28} color="#9CAF88" />
        <Text variant="subtitle" className="mt-3 text-center">
          No orders yet
        </Text>
        <Text variant="caption" className="mt-1 text-center">
          Active reservations, pickup codes, and receipts will appear here.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={layoutStyles.stackListContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(shopper)/orders/${item.id}`)}>
            <Card>
              <View className="mb-1 flex-row items-center justify-between">
                <Text variant="body" className="flex-1 pr-3 font-semibold">
                  {item.vendor?.business_name ?? 'Vendor'}
                </Text>
                <StatusPill status={item.order_status} />
              </View>
              <Text variant="caption">
                {item.event?.name ?? 'Event'} · {formatPrice(item.total)}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
