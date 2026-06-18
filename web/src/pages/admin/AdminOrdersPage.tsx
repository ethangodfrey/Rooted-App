import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDateTime, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/lib/order-status';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/database';
import '@/components/ui/ui.css';

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

export function AdminOrdersPage() {
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

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(
    () => orders.filter((o) => matchesFilter(o.order_status, filter)),
    [orders, filter],
  );

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Admin</p>
      <h1 className="app-title">Orders</h1>

      <div className="app-chip-row" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-chip${filter === item.key ? ' app-chip--selected' : ''}`}
            onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="app-error">{error}</p> : null}

      {loading ? (
        <div className="app-loading"><div className="app-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="app-empty">No orders.</div>
      ) : (
        <div className="app-list">
          {filtered.map((order) => {
            const itemCount = (order.order_items ?? []).reduce((s, i) => s + i.quantity, 0);
            return (
              <Link key={order.id} to={`/admin/orders/${order.id}`} className="app-card app-card--pressable app-row">
                <div className="app-row-body">
                  <p className="app-row-title">{formatPrice(order.total)}</p>
                  <p className="app-row-meta">
                    {ORDER_STATUS_LABEL[order.order_status]} · {order.vendor?.business_name ?? 'Vendor'}
                  </p>
                  <p className="app-row-meta">{formatDateTime(order.created_at)} · {itemCount} items</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
