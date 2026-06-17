import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { formatEventFullDate, formatPrice } from '@/src/lib/format';
import { canCancel } from '@/src/lib/order-status';
import { supabase } from '@/src/lib/supabase';
import type { Order } from '@/src/types/database';

interface DetailItem {
  id: string;
  quantity: number;
  item_price: number;
  item_title: string | null;
  product: { name: string } | null;
}

interface OrderDetail extends Order {
  vendor: { business_name: string | null } | null;
  event: { name: string; start_datetime: string; address: string | null } | null;
  leftover_listing: {
    title: string;
    pickup_address: string | null;
    pickup_city: string | null;
    pickup_state: string | null;
    pickup_notes: string | null;
    expires_at: string;
  } | null;
  order_items: DetailItem[];
}

export default function ShopperOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('orders')
      .select(
        '*, vendor:vendors(business_name), event:events(name, start_datetime, address), leftover_listing:leftover_listings(title, pickup_address, pickup_city, pickup_state, pickup_notes, expires_at), order_items(id, quantity, item_price, item_title, product:products(name))',
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

  function confirmCancel() {
    Alert.alert('Cancel reservation', 'This releases your reserved items.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel reservation',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          const { error: updError } = await supabase
            .from('orders')
            .update({ order_status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);
          setWorking(false);
          if (updError) {
            setError(updError.message);
            return;
          }
          load();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reservation',
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
              {order.vendor?.business_name ?? 'Vendor'}
            </Text>
            <StatusPill status={order.order_status} />
          </View>

          <Card className="mb-4">
            <Text variant="caption" className="mb-1">
              {order.leftover_listing ? 'Leftover pickup' : 'Pickup at'}
            </Text>
            <Text variant="body" className="font-semibold">
              {order.event?.name ?? order.leftover_listing?.title ?? 'Pickup'}
            </Text>
            {order.event ? (
              <Text variant="caption" className="mt-0.5">
                {formatEventFullDate(order.event.start_datetime)}
                {order.event.address ? ` · ${order.event.address}` : ''}
              </Text>
            ) : order.leftover_listing ? (
              <Text variant="caption" className="mt-0.5">
                {order.leftover_listing.pickup_address ??
                  (order.leftover_listing.pickup_city && order.leftover_listing.pickup_state
                    ? `${order.leftover_listing.pickup_city}, ${order.leftover_listing.pickup_state}`
                    : '')}
                {order.leftover_listing.pickup_notes
                  ? `\n${order.leftover_listing.pickup_notes}`
                  : ''}
              </Text>
            ) : null}
          </Card>

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
              {order.payment_status === 'paid_at_pickup' ? 'Paid at pickup' : 'Pay at pickup'}
            </Text>
          </Card>

          {order.notes ? (
            <Card className="mb-4">
              <Text variant="caption" className="mb-1">
                Your notes
              </Text>
              <Text variant="body">{order.notes}</Text>
            </Card>
          ) : null}

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

          {canCancel(order.order_status) ? (
            <Button
              label="Cancel reservation"
              variant="secondary"
              loading={working}
              onPress={confirmCancel}
            />
          ) : null}
        </Screen>
      )}
    </>
  );
}
