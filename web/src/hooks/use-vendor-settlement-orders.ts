import { useCallback, useEffect, useState } from 'react';

import { FULFILLED_ARCHIVE_STATUSES } from '@/lib/order-fulfillment';
import type { SettlementOrderInput } from '@/lib/settlement-calculator';
import { supabase } from '@/lib/supabase';

type SettlementOrderRow = {
  id: string;
  total: number;
  gross_cents?: number | null;
  platform_fee_cents?: number | null;
};

const SETTLEMENT_ORDER_SELECT = 'id, total, gross_cents, platform_fee_cents';

function toSettlementInput(row: SettlementOrderRow): SettlementOrderInput {
  const totalCents = row.gross_cents ?? row.total;
  const platformFeeCents = row.platform_fee_cents ?? undefined;

  return {
    id: row.id,
    totalCents,
    platformFeeCents: platformFeeCents ?? undefined,
  };
}

export interface UseVendorSettlementOrdersResult {
  orders: SettlementOrderInput[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useVendorSettlementOrders(
  vendorId: string | undefined,
): UseVendorSettlementOrdersResult {
  const [orders, setOrders] = useState<SettlementOrderInput[]>([]);
  const [loading, setLoading] = useState(Boolean(vendorId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!vendorId) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('orders')
      .select(SETTLEMENT_ORDER_SELECT)
      .eq('vendor_id', vendorId)
      .in('order_status', FULFILLED_ARCHIVE_STATUSES)
      .order('updated_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data ?? []).map((row) => toSettlementInput(row as SettlementOrderRow)));
    setLoading(false);
  }, [vendorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { orders, loading, error, refresh };
}
