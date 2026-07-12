import { useEffect, useState } from 'react';

import { IconBadge } from '@/components/vendor/dashboard-icons';
import {
  VendorEmpty,
  VendorHero,
  VendorListPanel,
  VendorScreen,
  VendorSection,
  VendorStatusPill,
  VENDOR_PRESSABLE,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import '@/components/ui/ui.css';

export function VendorOrdersPage() {
  const { vendor } = useAuth();
  const [orders, setOrders] = useState<
    { id: string; order_status: string; total: number; created_at: string; event: { name: string } | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!vendor) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('orders')
        .select('id, order_status, total, created_at, event:events(name)')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });
      setOrders((data as unknown as typeof orders) ?? []);
      setLoading(false);
    }
    load();
  }, [vendor]);

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Manage"
        title="Orders"
        pill={loading ? undefined : `${orders.length} total`}
      />

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : orders.length === 0 ? (
        <VendorEmpty message="No orders yet." />
      ) : (
        <VendorSection title="Order history">
          <VendorListPanel>
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/vendor/orders/${order.id}`}
                className={`flex items-center justify-between gap-3 p-3.5 no-underline active:bg-stone-100/80 ${VENDOR_PRESSABLE}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <IconBadge name="receipt" tone="amber" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-stone-800">
                      {order.event?.name ?? 'Order'}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {formatPrice(order.total)} · {formatDateTime(order.created_at)}
                    </span>
                  </span>
                </span>
                <VendorStatusPill label={order.order_status.replace(/_/g, ' ')} />
              </Link>
            ))}
          </VendorListPanel>
        </VendorSection>
      )}
    </VendorScreen>
  );
}
