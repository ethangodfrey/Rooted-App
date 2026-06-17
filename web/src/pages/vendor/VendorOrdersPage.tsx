import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function VendorOrdersPage() {
  const { vendor } = useAuth();
  const [orders, setOrders] = useState<{ id: string; order_status: string; total: number; created_at: string; event: { name: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!vendor) return;
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
    <div className="app-screen">
      <p className="app-eyebrow">Manage</p>
      <h1 className="app-title">Orders</h1>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="app-empty">No orders yet.</div>
      ) : (
        <div className="app-list">
          {orders.map((order) => (
            <Link key={order.id} to={`/vendor/orders/${order.id}`} className="app-card app-card--pressable">
              <div className="app-row" style={{ justifyContent: 'space-between' }}>
                <p className="app-row-title">{order.event?.name ?? 'Order'}</p>
                <span className="app-status">{order.order_status.replace(/_/g, ' ')}</span>
              </div>
              <p className="app-row-meta">{formatPrice(order.total)} · {formatDateTime(order.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
