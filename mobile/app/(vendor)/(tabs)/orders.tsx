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

interface VendorOrderRow {
  id: string;
  order_status: OrderStatus;
  total: number;
  created_at: string;
  event: { name: string } | null;
  order_items: { quantity: number }[];
}

const ACTIVE_STATUSES: OrderStatus[] = [
  'submitted',
  'pending_review',
  'accepted',
  'preparing',
  'ready_for_pickup',
];

export default function VendorOrdersScreen() {
  const { vendor } = useAuth();
  const [orders, setOrders] = useState<VendorOrderRow[]>([]);
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
          .from('orders')
          .select('id, order_status, total, created_at, event:events(name), order_items(quantity)')
          .eq('vendor_id', vendor.id)
          .order('created_at', { ascending: false });
        if (!active) return;
        setOrders((data as unknown as VendorOrderRow[]) ?? []);
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [vendor]),
  );

  const newCount = orders.filter(
    (o) => o.order_status === 'submitted' || o.order_status === 'pending_review',
  ).length;

  return (
    <Screen scroll={false}>
      <View className="mb-4">
        <Text variant="eyebrow" className="mb-2">
          Manage
        </Text>
        <Text variant="title">Orders</Text>
        {newCount > 0 ? (
          <Text variant="caption" className="mt-1">
            {newCount} awaiting your review
          </Text>
        ) : null}
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator />
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <FontAwesome name="inbox" size={28} color="#9CAF88" />
          <Text variant="caption" className="mt-3 text-center">
            No reservations yet. They&apos;ll appear here as shoppers reserve.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={layoutStyles.listContent}
          renderItem={({ item }) => {
            const units = item.order_items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <Pressable onPress={() => router.push(`/(vendor)/orders/${item.id}`)}>
                <Card
                  className={
                    ACTIVE_STATUSES.includes(item.order_status) &&
                    (item.order_status === 'submitted' || item.order_status === 'pending_review')
                      ? 'border-2 border-primary'
                      : ''
                  }>
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text variant="body" className="flex-1 pr-3 font-semibold">
                      {item.event?.name ?? 'Event'}
                    </Text>
                    <StatusPill status={item.order_status} />
                  </View>
                  <Text variant="caption">
                    {units} {units === 1 ? 'item' : 'items'} · {formatPrice(item.total)}
                  </Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
