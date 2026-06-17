import { router, useLocalSearchParams } from 'expo-router';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { StatusPill } from '@/src/components/ui/status-pill';
import { Text } from '@/src/components/ui/text';
import { formatEventFullDate, formatPrice } from '@/src/lib/format';
import { ORDER_STATUS_LABEL } from '@/src/lib/order-status';
import { supabase } from '@/src/lib/supabase';
import type { Order } from '@/src/types/database';

interface DetailItem {
  id: string;
  quantity: number;
  item_price: number;
  product: { name: string } | null;
}

interface AdminOrderDetail extends Order {
  vendor: { business_name: string | null; category: string | null } | null;
  event: {
    name: string;
    start_datetime: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  order_items: DetailItem[];
}

export default function AdminOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(
        '*, vendor:vendors(business_name, category), event:events(name, start_datetime, address, city, state), order_items(id, quantity, item_price, product:products(name))',
      )
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setOrder(null);
    } else if (!data) {
      setError('Order not found.');
      setOrder(null);
    } else {
      setOrder(data as unknown as AdminOrderDetail);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <Screen centered>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen scroll>
        <Card className="mb-4 bg-red-50">
          <Text variant="body" className="text-red-800">
            {error ?? 'Order not found.'}
          </Text>
        </Card>
        <Button label="Back to orders" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const location = [order.event?.address, order.event?.city, order.event?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <Screen scroll>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text variant="title" className="mb-0 flex-1">
          Order detail
        </Text>
        <StatusPill status={order.order_status} />
      </View>

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Vendor
        </Text>
        <Text variant="body" className="mb-3">
          {order.vendor?.business_name ?? '—'}
        </Text>
        {order.vendor?.category ? (
          <>
            <Text variant="caption" className="mb-1">
              Category
            </Text>
            <Text variant="body" className="mb-3">
              {order.vendor.category}
            </Text>
          </>
        ) : null}
        <Text variant="caption" className="mb-1">
          Event
        </Text>
        <Text variant="body" className="mb-1">
          {order.event?.name ?? '—'}
        </Text>
        {order.event?.start_datetime ? (
          <Text variant="caption" className="mb-3">
            {formatEventFullDate(order.event.start_datetime)}
          </Text>
        ) : null}
        {location ? (
          <>
            <Text variant="caption" className="mb-1">
              Location
            </Text>
            <Text variant="body">{location}</Text>
          </>
        ) : null}
      </Card>

      <Card className="mb-4">
        <Text variant="caption" className="mb-1">
          Status
        </Text>
        <Text variant="body" className="mb-3">
          {ORDER_STATUS_LABEL[order.order_status]}
        </Text>
        <Text variant="caption" className="mb-1">
          Payment
        </Text>
        <Text variant="body" className="mb-3 capitalize">
          {order.payment_status.replace('_', ' ')}
        </Text>
        <Text variant="caption" className="mb-1">
          Placed
        </Text>
        <Text variant="body">
          {new Date(order.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </Card>

      <Card className="mb-4">
        <Text variant="heading" className="mb-3">
          Items
        </Text>
        {order.order_items.map((item) => (
          <View key={item.id} className="mb-3 flex-row justify-between gap-3">
            <Text variant="body" className="flex-1">
              {item.quantity}× {item.product?.name ?? 'Item'}
            </Text>
            <Text variant="body">{formatPrice(item.item_price * item.quantity)}</Text>
          </View>
        ))}
        <View className="mt-2 border-t border-honeydew pt-3">
          <View className="mb-1 flex-row justify-between">
            <Text variant="caption">Subtotal</Text>
            <Text variant="caption">{formatPrice(order.subtotal)}</Text>
          </View>
          <View className="mb-1 flex-row justify-between">
            <Text variant="caption">Tax</Text>
            <Text variant="caption">{formatPrice(order.tax)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text variant="body" className="font-semibold">
              Total
            </Text>
            <Text variant="body" className="font-semibold">
              {formatPrice(order.total)}
            </Text>
          </View>
        </View>
      </Card>

      {order.notes ? (
        <Card className="mb-4">
          <Text variant="caption" className="mb-1">
            Shopper notes
          </Text>
          <Text variant="body">{order.notes}</Text>
        </Card>
      ) : null}

      <Text variant="caption" className="mb-4 text-center">
        Admin view is read-only. Vendors manage fulfillment in their orders tab.
      </Text>

      <Button label="Back to orders" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
