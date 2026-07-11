import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { OrderStatus, PaymentStatus } from '@/types/database';

export interface ShopperOrderItem {
  id: string;
  quantity: number;
  item_price: number;
  item_title: string | null;
  product: { name: string } | null;
}

export interface ShopperOrderEvent {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  start_datetime: string;
  end_datetime: string | null;
  timezone: string | null;
  hours_summary: string | null;
  sync_metadata: Record<string, unknown> | null;
}

export interface ShopperOrderRow {
  id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  created_at: string;
  pickup_code: string | null;
  fulfillment_window_start: string | null;
  fulfillment_window_end: string | null;
  vendor: { business_name: string | null } | null;
  event: ShopperOrderEvent | null;
  order_items: ShopperOrderItem[];
}

const ORDER_LIST_SELECT =
  'id, order_status, payment_status, total, created_at, pickup_code, fulfillment_window_start, fulfillment_window_end, vendor:vendors(business_name), event:events(id, name, city, state, address, start_datetime, end_datetime, timezone, hours_summary, sync_metadata), order_items(id, quantity, item_price, item_title, product:products(name))';

export function useShopperOrders(shopperId: string | undefined) {
  const [orders, setOrders] = useState<ShopperOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!shopperId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .eq('shopper_id', shopperId)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setOrders([]);
    } else {
      setOrders((data as unknown as ShopperOrderRow[]) ?? []);
    }
    setLoading(false);
  }, [shopperId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { orders, loading, error, reload };
}
