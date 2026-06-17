import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

export function ShopperOrdersPage() {
  const { shopper } = useAuth();
  const [orders, setOrders] = useState<{ id: string; order_status: string; total: number; created_at: string; vendor: { business_name: string | null } | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!shopper) return;
      const { data } = await supabase
        .from('orders')
        .select('id, order_status, total, created_at, vendor:vendors(business_name)')
        .eq('shopper_id', shopper.id)
        .order('created_at', { ascending: false });
      setOrders((data as unknown as typeof orders) ?? []);
      setLoading(false);
    }
    load();
  }, [shopper]);

  return (
    <div className="app-screen">
      <Link to="/shopper/profile" className="app-back-link">← Profile</Link>
      <h1 className="app-title">My reservations</h1>

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="app-empty">No reservations yet.</div>
      ) : (
        <div className="app-list">
          {orders.map((order) => (
            <Link key={order.id} to={`/shopper/orders/${order.id}`} className="app-card app-card--pressable">
              <div className="app-row" style={{ justifyContent: 'space-between' }}>
                <p className="app-row-title">{order.vendor?.business_name ?? 'Order'}</p>
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
