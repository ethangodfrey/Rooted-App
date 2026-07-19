import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  FULFILLED_ARCHIVE_STATUSES,
  isFulfilledArchive,
  isPendingPickup,
  paymentStatusOnFulfill,
  PENDING_PICKUP_STATUSES,
} from '@/lib/order-fulfillment';
import { supabase } from '@/lib/supabase';
import type { OrderStatus, PaymentStatus } from '@/types/database';

export interface FulfillmentOrderItem {
  id: string;
  quantity: number;
  item_price: number;
  item_title: string | null;
  product: { name: string } | null;
}

export interface FulfillmentOrderRow {
  id: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  created_at: string;
  updated_at: string;
  pickup_code: string | null;
  event_id: string | null;
  shopper: { user: { name: string | null; email: string | null } | null } | null;
  event: { id: string; name: string } | null;
  order_items: FulfillmentOrderItem[];
}

export interface VendorMarketSlot {
  id: string;
  name: string;
  start_datetime: string;
}

const FULFILLMENT_SELECT =
  'id, order_status, payment_status, total, created_at, updated_at, pickup_code, event_id, shopper:shoppers(user:users(name, email)), event:events(id, name), order_items(id, quantity, item_price, item_title, product:products(name))';

export interface FulfillmentCounts {
  pending: number;
  fulfilled: number;
}

export function useFulfillmentOrders(vendorId: string | undefined) {
  const [markets, setMarkets] = useState<VendorMarketSlot[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | 'all'>('all');
  const [pendingOrders, setPendingOrders] = useState<FulfillmentOrderRow[]>([]);
  const [fulfilledOrders, setFulfilledOrders] = useState<FulfillmentOrderRow[]>([]);
  const [counts, setCounts] = useState<FulfillmentCounts>({ pending: 0, fulfilled: 0 });
  const [loading, setLoading] = useState(true);
  const [marketsLoaded, setMarketsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fulfillingIds, setFulfillingIds] = useState<Set<string>>(() => new Set());

  const marketIds = useMemo(() => markets.map((market) => market.id), [markets]);

  const loadMarkets = useCallback(async () => {
    if (!vendorId) {
      setMarkets([]);
      setMarketsLoaded(true);
      return;
    }

    setMarketsLoaded(false);

    try {
      const { data, error: queryError } = await supabase
        .from('vendor_events')
        .select('event:events(id, name, start_datetime)')
        .eq('vendor_id', vendorId)
        .eq('participation_status', 'approved')
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setMarkets([]);
        return;
      }

      const slots = (data ?? [])
        .map((row) => {
          const raw = row.event as unknown as VendorMarketSlot | VendorMarketSlot[] | null;
          if (Array.isArray(raw)) return raw[0] ?? null;
          return raw;
        })
        .filter((event): event is VendorMarketSlot => Boolean(event?.id))
        .sort(
          (a, b) =>
            new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime(),
        );

      setMarkets(slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markets');
      setMarkets([]);
    } finally {
      setMarketsLoaded(true);
    }
  }, [vendorId]);

  const loadOrders = useCallback(async () => {
    if (!vendorId) {
      setPendingOrders([]);
      setFulfilledOrders([]);
      setCounts({ pending: 0, fulfilled: 0 });
      setLoading(false);
      return;
    }

    if (selectedMarketId === 'all' && !marketsLoaded) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedMarketId === 'all' && marketIds.length === 0) {
        setPendingOrders([]);
        setFulfilledOrders([]);
        setCounts({ pending: 0, fulfilled: 0 });
        return;
      }

      let query = supabase
        .from('orders')
        .select(FULFILLMENT_SELECT)
        .eq('vendor_id', vendorId)
        .in('order_status', [...PENDING_PICKUP_STATUSES, ...FULFILLED_ARCHIVE_STATUSES])
        .order('created_at', { ascending: false });

      if (selectedMarketId !== 'all') {
        query = query.eq('event_id', selectedMarketId);
      } else {
        query = query.in('event_id', marketIds);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        setError(queryError.message);
        setPendingOrders([]);
        setFulfilledOrders([]);
        setCounts({ pending: 0, fulfilled: 0 });
        return;
      }

      const rows = (data as unknown as FulfillmentOrderRow[]) ?? [];
      const pending = rows.filter((row) => isPendingPickup(row.order_status));
      const fulfilled = rows.filter((row) => isFulfilledArchive(row.order_status));

      setPendingOrders(pending);
      setFulfilledOrders(fulfilled);
      setCounts({ pending: pending.length, fulfilled: fulfilled.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      setPendingOrders([]);
      setFulfilledOrders([]);
      setCounts({ pending: 0, fulfilled: 0 });
    } finally {
      setLoading(false);
    }
  }, [vendorId, selectedMarketId, marketIds, marketsLoaded]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const fulfillOrder = useCallback(
    async (orderId: string) => {
      if (!vendorId || fulfillingIds.has(orderId)) return;

      const order = pendingOrders.find((row) => row.id === orderId);
      if (!order) return;

      const previousPending = pendingOrders;
      const previousFulfilled = fulfilledOrders;
      const previousCounts = counts;

      const fulfilledSnapshot: FulfillmentOrderRow = {
        ...order,
        order_status: 'fulfilled',
        payment_status: paymentStatusOnFulfill(order.payment_status) ?? order.payment_status,
        updated_at: new Date().toISOString(),
      };

      setFulfillingIds((current) => new Set(current).add(orderId));
      setPendingOrders((current) => current.filter((row) => row.id !== orderId));
      setFulfilledOrders((current) => [fulfilledSnapshot, ...current]);
      setCounts((current) => ({
        pending: Math.max(0, current.pending - 1),
        fulfilled: current.fulfilled + 1,
      }));

      try {
        const paymentPatch = paymentStatusOnFulfill(order.payment_status);
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            order_status: 'fulfilled',
            updated_at: fulfilledSnapshot.updated_at,
            ...(paymentPatch ? { payment_status: paymentPatch } : {}),
          })
          .eq('id', orderId)
          .eq('vendor_id', vendorId);

        if (updateError) {
          setPendingOrders(previousPending);
          setFulfilledOrders(previousFulfilled);
          setCounts(previousCounts);
          setError(updateError.message);
        }
      } catch (err) {
        setPendingOrders(previousPending);
        setFulfilledOrders(previousFulfilled);
        setCounts(previousCounts);
        setError(err instanceof Error ? err.message : 'Failed to fulfill order');
      } finally {
        setFulfillingIds((current) => {
          const next = new Set(current);
          next.delete(orderId);
          return next;
        });
      }
    },
    [vendorId, fulfillingIds, pendingOrders, fulfilledOrders, counts],
  );

  return {
    markets,
    selectedMarketId,
    setSelectedMarketId,
    pendingOrders,
    fulfilledOrders,
    counts,
    loading,
    error,
    fulfillingIds,
    fulfillOrder,
    reload: loadOrders,
  };
}
