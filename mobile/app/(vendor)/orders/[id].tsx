import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { formatEventFullDate, formatPrice } from '@/src/lib/format';
import { nextVendorStatus } from '@/src/lib/order-status';
import { supabase } from '@/src/lib/supabase';
import type { Order, OrderStatus } from '@/src/types/database';

interface DetailItem {
  id: string;
  quantity: number;
  item_price: number;
  item_title: string | null;
  product: { name: string } | null;
}

interface OrderDetail extends Order {
  event: { name: string; start_datetime: string; address: string | null } | null;
  leftover_listing: {
    title: string;
    pickup_address: string | null;
    pickup_city: string | null;
    pickup_state: string | null;
    pickup_notes: string | null;
  } | null;
  order_items: DetailItem[];
}

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  preparing: 'Start preparing',
  ready_for_pickup: 'Mark ready for pickup',
  fulfilled: 'Mark fulfilled & paid',
};

export default function VendorOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('orders')
      .select(
        '*, event:events(name, start_datetime, address), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes), order_items(id, quantity, item_price, item_title, product:products(name))',
      )
      .eq('id', id)
      .maybeSingle();
    if (queryError) setError(queryError.message);
    else if (!data) setError('Order not found.');
    else setOrder(data as unknown as OrderDetail);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const updateStatus = useCallback(
    async (status: OrderStatus, extra?: Record<string, unknown>) => {
      setWorking(true);
      setError(null);
      const { error: updError } = await supabase
        .from('orders')
        .update({ order_status: status, updated_at: new Date().toISOString(), ...extra })
        .eq('id', id);
      setWorking(false);
      if (updError) {
        setError(updError.message);
        return;
      }
      load();
    },
    [id, load],
  );

  const next = order ? nextVendorStatus(order.order_status) : null;
  const isNew =
    order?.order_status === 'submitted' || order?.order_status === 'pending_review';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Order',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : !order ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'Order not found.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="title" className="flex-1 pr-3">
              {order.event?.name ?? order.leftover_listing?.title ?? 'Order'}
            </Text>
            <StatusPill status={order.order_status} />
          </View>

          {order.event ? (
            <Card className="mb-4">
              <Text variant="caption" className="mb-1">
                Pickup
              </Text>
              <Text variant="body">
                {formatEventFullDate(order.event.start_datetime)}
                {order.event.address ? `\n${order.event.address}` : ''}
              </Text>
            </Card>
          ) : order.leftover_listing ? (
            <Card className="mb-4">
              <Text variant="caption" className="mb-1">
                Leftover pickup
              </Text>
              <Text variant="body">
                {order.leftover_listing.pickup_address ??
                  (order.leftover_listing.pickup_city && order.leftover_listing.pickup_state
                    ? `${order.leftover_listing.pickup_city}, ${order.leftover_listing.pickup_state}`
                    : order.leftover_listing.title)}
                {order.leftover_listing.pickup_notes
                  ? `\n${order.leftover_listing.pickup_notes}`
                  : ''}
              </Text>
            </Card>
          ) : null}

          <Text variant="heading" className="mb-3">
            Items
          </Text>
          <View className="mb-4 gap-2">
            {order.order_items.map((item) => (
              <Card key={item.id} className="flex-row items-center justify-between">
                <Text variant="body" className="flex-1 pr-3">
                  {item.quantity} × {item.product?.name ?? item.item_title ?? 'Item'}
                </Text>
                <Text variant="body" className="font-semibold">
                  {formatPrice(item.item_price * item.quantity)}
                </Text>
              </Card>
            ))}
          </View>

          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text variant="body" className="font-semibold">
                Total
              </Text>
              <Text variant="subtitle">{formatPrice(order.total)}</Text>
            </View>
            <Text variant="caption" className="mt-1">
              {order.payment_status === 'paid_at_pickup' ? 'Paid at pickup' : 'Unpaid · pay at pickup'}
            </Text>
          </Card>

          {order.notes ? (
            <Card className="mb-4">
              <Text variant="caption" className="mb-1">
                Shopper notes
              </Text>
              <Text variant="body">{order.notes}</Text>
            </Card>
          ) : null}

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          <View className="gap-3">
            {isNew ? (
              <>
                <Button
                  label="Accept order"
                  loading={working}
                  onPress={() => updateStatus('accepted')}
                />
                <Button
                  label="Decline"
                  variant="secondary"
                  loading={working}
                  onPress={() => updateStatus('declined')}
                />
              </>
            ) : next ? (
              <Button
                label={ADVANCE_LABEL[next] ?? 'Advance'}
                loading={working}
                onPress={() =>
                  updateStatus(
                    next,
                    next === 'fulfilled' ? { payment_status: 'paid_at_pickup' } : undefined,
                  )
                }
              />
            ) : (
              <Text variant="caption" className="text-center">
                No further actions for this order.
              </Text>
            )}
          </View>
        </Screen>
      )}
    </>
  );
}
