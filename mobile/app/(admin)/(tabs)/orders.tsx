import { router, useFocusEffect } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card, PressableCard } from '@/src/components/ui/card';
import { Chip } from '@/src/components/ui/chip';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { formatDateTime, formatPrice } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import type { OrderStatus } from '@/src/types/database';

type Filter = 'all' | 'active' | 'fulfilled' | 'closed';

interface AdminOrderRow {
  id: string;
  order_status: OrderStatus;
  payment_status: string;
  total: number;
  created_at: string;
  vendor: { business_name: string | null } | null;
  event: { name: string } | null;
  order_items: { quantity: number }[];
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'closed', label: 'Closed' },
];

const ACTIVE_STATUSES: OrderStatus[] = [
  'submitted',
  'pending_review',
  'accepted',
  'preparing',
  'ready_for_pickup',
];

const CLOSED_STATUSES: OrderStatus[] = ['declined', 'cancelled'];

function matchesFilter(status: OrderStatus, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return ACTIVE_STATUSES.includes(status);
  if (filter === 'fulfilled') return status === 'fulfilled';
  return CLOSED_STATUSES.includes(status);
}

export default function AdminOrdersScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(
        'id, order_status, payment_status, total, created_at, vendor:vendors(business_name), event:events(name), order_items(quantity)',
      )
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setOrders([]);
    } else {
      setOrders((data as unknown as AdminOrderRow[]) ?? []);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order.order_status, filter)),
    [orders, filter],
  );

  const activeCount = useMemo(
    () => orders.filter((order) => ACTIVE_STATUSES.includes(order.order_status)).length,
    [orders],
  );

  return (
    <Screen scroll>
      <Text variant="eyebrow" className="mb-2">
        Admin
      </Text>
      <Text variant="title" className="mb-1">
        Orders
      </Text>
      <Text variant="subtitle" className="mb-4">
        Read-only oversight across all vendor reservations.
      </Text>

      {activeCount > 0 ? (
        <Text variant="caption" className="mb-4 text-forest">
          {activeCount} active reservation{activeCount === 1 ? '' : 's'} platform-wide
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-6"
        contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      {error ? (
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error}
          </Text>
          <View className="mt-3">
            <Button label="Retry" variant="secondary" onPress={loadOrders} />
          </View>
        </Card>
      ) : null}

      {loading ? (
        <View className="items-center py-12">
          <LoadingIndicator />
        </View>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <Text variant="heading" className="mb-1">
            No orders found
          </Text>
          <Text variant="caption">
            {filter === 'all'
              ? 'Reservations will appear here as shoppers reserve from vendors.'
              : `No ${filter} orders right now. Try another filter.`}
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          {filteredOrders.map((order) => {
            const units = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <PressableCard
                key={order.id}
                onPress={() => router.push(`/(admin)/orders/${order.id}`)}>
                <View className="mb-2 flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="heading" className="mb-1">
                      {order.vendor?.business_name ?? 'Vendor'}
                    </Text>
                    <Text variant="caption" className="mb-1">
                      {order.event?.name ?? 'Event'}
                    </Text>
                    <Text variant="caption">{formatDateTime(order.created_at)}</Text>
                  </View>
                  <StatusPill status={order.order_status} />
                </View>
                <Text variant="body">
                  {units} {units === 1 ? 'item' : 'items'} · {formatPrice(order.total)}
                </Text>
                <Text variant="caption" className="mt-1 capitalize">
                  Payment: {order.payment_status.replace('_', ' ')}
                </Text>
              </PressableCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
